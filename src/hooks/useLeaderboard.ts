import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry } from '@/types'

export function useLeaderboard() {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .order('rank', { ascending: true })

      if (error) throw error
      return data as LeaderboardEntry[]
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

  return {
    leaderboard,
    isLoading,
    error,
    getTopUsers,
    getUserRank,
    getUserPosition,
    getTotalParticipants
  }
}
