import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import { isUserProfile } from '@/types/utils'
import { sanitizeErrorMessage, withSecureErrorHandling } from '@/utils/secure-error-handling'
import { checkAuthRateLimit } from '@/utils/rate-limiting'
import { SignUpSchema, SignInSchema, safeValidate } from '@/utils/validation'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'

// Session timeout configuration (8 hours in milliseconds)
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000
let sessionTimer: ReturnType<typeof setTimeout> | null = null

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastActivity, setLastActivity] = useState<number>(Date.now())

  // Track user activity to detect idle sessions
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now())
    
    // Listen for user activity
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    window.addEventListener('scroll', updateActivity)
    
    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('scroll', updateActivity)
    }
  }, [])

  // Check for session timeout
  useEffect(() => {
    if (!user) return
    
    const checkSession = () => {
      const idleTime = Date.now() - lastActivity
      if (idleTime > SESSION_TIMEOUT_MS) {
        console.warn('[AUTH] Session timeout due to inactivity')
        signOut().catch(console.error)
      }
    }
    
    if (sessionTimer) clearInterval(sessionTimer)
    sessionTimer = setInterval(checkSession, 60000) // Check every minute
    
    return () => {
      if (sessionTimer) {
        clearInterval(sessionTimer)
        sessionTimer = null
      }
    }
  }, [user, lastActivity])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const result = await withSecureErrorHandling(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (isUserProfile(data)) {
        setProfile(data)
        return data
      } else {
        console.warn('[useAuth] Profile data failed type validation', data)
        setProfile(data as UserProfile)
        return data as UserProfile
      }
    }, 'profile')

    if (!result.success) {
      // Error already logged by withSecureErrorHandling
      console.error('Error fetching profile:', result.error)
    }
  }

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    try {
      setError(null)
      
      // Validate input with Zod
      const validation = safeValidate(SignUpSchema, { email, password, username })
      if (!validation.success) {
        setError(validation.error)
        return { success: false as const, error: validation.error }
      }
      
      // Check client-side rate limit
      const rateLimit = checkAuthRateLimit(email)
      if (!rateLimit.allowed) {
        const errorMessage = `Demasiados intentos de registro. Intenta nuevamente en ${rateLimit.retryAfter} segundos.`
        setError(errorMessage)
        return { success: false as const, error: errorMessage }
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: { username: validation.data.username },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (error) throw error
      
      // Create profile after signup
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          username: validation.data.username,
          preferred_language: 'es'
        })
        
        if (profileError) {
          // Log but don't fail signup - profile can be created later
          console.warn('[useAuth] Failed to create profile:', profileError)
        }
      }

      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Usuario registrado exitosamente',
        userId: data.user?.id,
      })
      
      return { success: true as const, user: data.user }
    } catch (err: unknown) {
      const { userMessage } = sanitizeErrorMessage(err, 'authentication')
      setError(userMessage)
      return { success: false as const, error: userMessage }
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null)
      
      // Validate input with Zod
      const validation = safeValidate(SignInSchema, { email, password })
      if (!validation.success) {
        setError(validation.error)
        return { success: false as const, error: validation.error }
      }
      
      // Check client-side rate limit
      const rateLimit = checkAuthRateLimit(email)
      if (!rateLimit.allowed) {
        const errorMessage = `Demasiados intentos de inicio de sesión. Intenta nuevamente en ${rateLimit.retryAfter} segundos.`
        setError(errorMessage)
        return { success: false as const, error: errorMessage }
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password
      })

      if (error) throw error
      
      // Update last activity on successful login
      setLastActivity(Date.now())
      
      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Inicio de sesión exitoso',
        userId: data.user?.id,
      })
      
      return { success: true as const, user: data.user }
    } catch (err: unknown) {
      const { userMessage } = sanitizeErrorMessage(err, 'authentication')
      setError(userMessage)
      return { success: false as const, error: userMessage }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear session timer
      if (sessionTimer) {
        clearInterval(sessionTimer)
        sessionTimer = null
      }
      
      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Sesión cerrada',
      })
      return { success: true as const }
    } catch (err: unknown) {
      const { userMessage } = sanitizeErrorMessage(err, 'authentication')
      setError(userMessage)
      return { success: false as const, error: userMessage }
    }
  }, [])

  // Password reset
  const resetPassword = useCallback(async (email: string) => {
    try {
      setError(null)
      
      const validation = safeValidate(SignInSchema.pick({ email: true }), { email })
      if (!validation.success) {
        setError(validation.error)
        return { success: false as const, error: validation.error }
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      
      if (error) throw error
      
      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Solicitud de restablecimiento de contraseña enviada',
      })
      
      return { success: true as const }
    } catch (err: unknown) {
      const { userMessage } = sanitizeErrorMessage(err, 'authentication')
      setError(userMessage)
      return { success: false as const, error: userMessage }
    }
  }, [])

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      setError(null)
      
      const validation = safeValidate(SignInSchema.pick({ password: true }), { password: newPassword })
      if (!validation.success) {
        setError(validation.error)
        return { success: false as const, error: validation.error }
      }
      
      const { error } = await supabase.auth.updateUser({
        password: validation.data.password
      })
      
      if (error) throw error
      
      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Contraseña actualizada exitosamente',
        userId: user?.id,
      })
      
      return { success: true as const }
    } catch (err: unknown) {
      const { userMessage } = sanitizeErrorMessage(err, 'authentication')
      setError(userMessage)
      return { success: false as const, error: userMessage }
    }
  }, [user])

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      
      if (data.session) {
        setUser(data.session.user)
        return { success: true as const, user: data.session.user }
      }
      
      return { success: false as const, error: 'No hay sesión para refrescar' }
    } catch (err: unknown) {
      const { userMessage } = sanitizeErrorMessage(err, 'authentication')
      return { success: false as const, error: userMessage }
    }
  }, [])

  return {
    user,
    profile,
    isLoading,
    error,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
  }
}