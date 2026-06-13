import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import { isUserProfile } from '@/types/utils'
import { getSupabaseErrorMessage } from '@/types/supabase-augmented'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (isUserProfile(data)) {
        setProfile(data)
      } else {
        console.warn('[useAuth] Profile data failed type validation', data)
        setProfile(data as UserProfile)
      }
    } catch (err: unknown) {
      errorLogger.error({
        operation: 'READ',
        entity: 'profile',
        message: getSupabaseErrorMessage(err),
        userId,
      })
      console.error('Error fetching profile:', err)
    }
  }

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      })

      if (error) throw error
      
      // Create profile after signup
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          preferred_language: 'es'
        })
      }

      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Usuario registrado exitosamente',
        userId: data.user?.id,
      })
      
      return { success: true as const, user: data.user }
    } catch (err: unknown) {
      const message = getSupabaseErrorMessage(err)
      errorLogger.error({
        operation: 'AUTH',
        entity: 'auth',
        message,
        metadata: { email },
      })
      setError(message)
      return { success: false as const, error: message }
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Inicio de sesión exitoso',
        userId: data.user?.id,
      })
      
      return { success: true as const, user: data.user }
    } catch (err: unknown) {
      const message = getSupabaseErrorMessage(err)
      errorLogger.error({
        operation: 'AUTH',
        entity: 'auth',
        message,
        metadata: { email },
      })
      setError(message)
      return { success: false as const, error: message }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      errorLogger.info({
        operation: 'AUTH',
        entity: 'auth',
        message: 'Sesión cerrada',
      })
      return { success: true as const }
    } catch (err: unknown) {
      const message = getSupabaseErrorMessage(err)
      errorLogger.error({
        operation: 'AUTH',
        entity: 'auth',
        message,
      })
      setError(message)
      return { success: false as const, error: message }
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
    signOut
  }
}