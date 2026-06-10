import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any>(null)
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
      setProfile(data)
    } catch (err) {
      errorLogger.error({
        operation: 'READ',
        entity: 'profile',
        message: (err as Error).message || 'Error fetching profile',
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
      
      return { success: true, user: data.user }
    } catch (err: any) {
      errorLogger.error({
        operation: 'AUTH',
        entity: 'auth',
        message: err.message || 'Error al registrar',
        metadata: { email },
      })
      setError(err.message)
      return { success: false, error: err.message }
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
      
      return { success: true, user: data.user }
    } catch (err: any) {
      errorLogger.error({
        operation: 'AUTH',
        entity: 'auth',
        message: err.message || 'Error al iniciar sesión',
        metadata: { email },
      })
      setError(err.message)
      return { success: false, error: err.message }
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
      return { success: true }
    } catch (err: any) {
      errorLogger.error({
        operation: 'AUTH',
        entity: 'auth',
        message: err.message || 'Error al cerrar sesión',
      })
      setError(err.message)
      return { success: false, error: err.message }
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
