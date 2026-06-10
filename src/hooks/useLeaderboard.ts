import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import type { LeaderboardEntry } from '@/types'

export function useLeaderboard() {
  const queryClient = useQueryClient()
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('leaderboard_cache')
          .select('*')
          .order('rank', { ascending: true })

        if (error) throw error

        errorLogger.info({
          operation: 'READ',
          entity: 'leaderboard',
          message: `${data.length} participantes en el ranking`,
        })

        return data as LeaderboardEntry[]
      } catch (err: any) {
        errorLogger.error({
          operation: 'READ',
          entity: 'leaderboard',
          message: err.message || 'Error al cargar leaderboard',
          statusCode: err.status || err.code,
        })
        throw err
      }
    },
    staleTime: 60 * 1000 // 1 minute
  })

  const getTopUsers = (limit: number = 10) => {
    return leaderboard?.slice(0, limit)
  }

  const getUserRank = (userId: string) => {
    const entry = leaderboard?.find(e => e.user_id === userId)
    return entry?.rank ?? null
  }

  const getUserPosition = (userId: string) => {
    return leaderboard?.find(e => e.user_id === userId)
  }

  const getTotalParticipants = () => {
    return leaderboard?.length ?? 0
  }

  const refreshLeaderboard = async () => {
    try {
      const { data, error } = await supabase.rpc('refresh_leaderboard_manual')
      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] })

      errorLogger.info({
        operation: 'UPDATE',
        entity: 'leaderboard',
        message: data || 'Leaderboard actualizado',
      })

      return { success: true, message: data }
    } catch (err: any) {
      errorLogger.error({
        operation: 'UPDATE',
        entity: 'leaderboard',
        message: err.message || 'Error al actualizar leaderboard',
        statusCode: err.status || err.code,
      })
      throw err
    }
  }

  return {
    leaderboard,
    isLoading,
    error,
    getTopUsers,
    getUserRank,
    getUserPosition,
    getTotalParticipants,
    refreshLeaderboard
  }
}
