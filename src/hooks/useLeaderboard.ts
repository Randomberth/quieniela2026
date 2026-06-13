import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import { safeCastLeaderboard } from '@/types/utils'
import { getSupabaseErrorMessage, getSupabaseStatusCode } from '@/types/supabase-augmented'

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

        const validData = safeCastLeaderboard(data)

        errorLogger.info({
          operation: 'READ',
          entity: 'leaderboard',
          message: `${validData.length} participantes en el ranking`,
        })

        return validData
      } catch (err: unknown) {
        const message = getSupabaseErrorMessage(err)
        errorLogger.error({
          operation: 'READ',
          entity: 'leaderboard',
          message,
          statusCode: getSupabaseStatusCode(err),
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
        message: typeof data === 'string' ? data : 'Leaderboard actualizado',
      })

      return { success: true as const, message: typeof data === 'string' ? data : 'Leaderboard actualizado' }
    } catch (err: unknown) {
      const message = getSupabaseErrorMessage(err)
      errorLogger.error({
        operation: 'UPDATE',
        entity: 'leaderboard',
        message,
        statusCode: getSupabaseStatusCode(err),
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