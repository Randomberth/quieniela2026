import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Match, Team } from '@/types'

const STALE_TIME = 5 * 60 * 1000 // 5 minutes

export function useMatches() {
  const queryClient = useQueryClient()

  const { data: matches, isLoading, error } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id(*),
          away_team:away_team_id(*)
        `)
        .order('match_date', { ascending: true })

      if (error) throw error

      return (data as any[]).map(match => ({
        ...match,
        home_team: match.home_team as Team,
        away_team: match.away_team as Team,
        is_locked: new Date(match.match_date) <= new Date() || match.status !== 'pending'
      })) as Match[]
    },
    staleTime: STALE_TIME
  })

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('group_name', { ascending: true })

      if (error) throw error
      return data as Team[]
    },
    staleTime: STALE_TIME
  })

  const getMatchById = (id: string) => {
    return matches?.find(m => m.id === id)
  }

  const getMatchesByGroup = (group: string) => {
    return matches?.filter(m => m.group_name === group && m.phase === 'group')
  }

  const getMatchesByPhase = (phase: string) => {
    return matches?.filter(m => m.phase === phase)
  }

  const getUpcomingMatches = (limit: number = 5) => {
    return matches?.filter(m => new Date(m.match_date) > new Date()).slice(0, limit)
  }

  const getLiveMatches = () => {
    return matches?.filter(m => m.status === 'live')
  }

  const getFinishedMatches = () => {
    return matches?.filter(m => m.status === 'finished')
  }

  const invalidateMatches = () => {
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }

  return {
    matches,
    teams,
    isLoading,
    error,
    getMatchById,
    getMatchesByGroup,
    getMatchesByPhase,
    getUpcomingMatches,
    getLiveMatches,
    getFinishedMatches,
    invalidateMatches
  }
}
