import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Prediction } from '@/types'

export function usePredictions(userId?: string) {
  const queryClient = useQueryClient()

  const { data: predictions, isLoading, error } = useQuery({
    queryKey: ['predictions', userId],
    queryFn: async () => {
      if (!userId) return []
      
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Prediction[]
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })

  const getPredictionForMatch = (matchId: string) => {
    return predictions?.find(p => p.match_id === matchId)
  }

  const savePrediction = useMutation({
    mutationFn: async ({
      matchId,
      homeScore,
      awayScore
    }: {
      matchId: string
      homeScore: number
      awayScore: number
    }) => {
      if (!userId) throw new Error('Usuario no autenticado')

      // Check if match is locked (trigger will block, but we check here for UX)
      const { data: match } = await supabase
        .from('matches')
        .select('match_date, status')
        .eq('id', matchId)
        .single()

      if (!match) throw new Error('Partido no encontrado')
      
      if (new Date(match.match_date) <= new Date() || match.status !== 'pending') {
        throw new Error('El partido ya ha comenzado o está bloqueado')
      }

      // Check if prediction already exists
      const existingPrediction = getPredictionForMatch(matchId)

      let result
      if (existingPrediction) {
        // Update
        result = await supabase
          .from('predictions')
          .update({
            home_score: homeScore,
            away_score: awayScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPrediction.id)
          .select()
          .single()
      } else {
        // Insert
        result = await supabase
          .from('predictions')
          .insert({
            user_id: userId,
            match_id: matchId,
            home_score: homeScore,
            away_score: awayScore
          })
          .select()
          .single()
      }

      if (result.error) throw result.error
      return result.data as Prediction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', userId] })
    }
  })

  const deletePrediction = useMutation({
    mutationFn: async (predictionId: string) => {
      if (!userId) throw new Error('Usuario no autenticado')

      const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', predictionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', userId] })
    }
  })

  const getUserStats = () => {
    if (!predictions?.length) return null

    const total = predictions.length
    const exact = predictions.filter(p => p.points_earned === 3).length
    const tendency = predictions.filter(p => p.points_earned === 1).length
    const totalPoints = predictions.reduce((sum, p) => sum + p.points_earned, 0)

    return {
      total,
      exact,
      tendency,
      totalPoints,
      average: total > 0 ? (totalPoints / total).toFixed(2) : '0.00'
    }
  }

  return {
    predictions,
    isLoading,
    error,
    getPredictionForMatch,
    savePrediction,
    deletePrediction,
    getUserStats,
    isSaving: savePrediction.isPending,
    isDeleting: deletePrediction.isPending,
    saveError: savePrediction.error,
    deleteError: deletePrediction.error
  }
}
