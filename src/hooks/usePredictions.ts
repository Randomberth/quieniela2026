import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import type { Prediction } from '@/types'

export function usePredictions(userId?: string) {
  const queryClient = useQueryClient()

  const { data: predictions, isLoading, error } = useQuery({
    queryKey: ['predictions', userId],
    queryFn: async () => {
      if (!userId) return []
      
      try {
        const { data, error } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error

        errorLogger.info({
          operation: 'READ',
          entity: 'predictions',
          message: `${data.length} predicciones cargadas`,
          userId,
        })

        return data as Prediction[]
      } catch (err: any) {
        errorLogger.error({
          operation: 'READ',
          entity: 'predictions',
          message: err.message || 'Error al cargar predicciones',
          statusCode: err.status || err.code,
          userId,
        })
        throw err
      }
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

      try {
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

        errorLogger.info({
          operation: existingPrediction ? 'UPDATE' : 'CREATE',
          entity: 'predictions',
          message: existingPrediction ? 'Predicción actualizada' : 'Predicción guardada',
          userId,
          metadata: { matchId, homeScore, awayScore },
        })

        return result.data as Prediction
      } catch (err: any) {
        errorLogger.error({
          operation: existingPrediction ? 'UPDATE' : 'CREATE',
          entity: 'predictions',
          message: err.message || 'Error al guardar predicción',
          statusCode: err.status || err.code,
          userId,
          metadata: { matchId, homeScore, awayScore },
        })
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', userId] })
    }
  })

  const deletePrediction = useMutation({
    mutationFn: async (predictionId: string) => {
      if (!userId) throw new Error('Usuario no autenticado')

      try {
        const { error } = await supabase
          .from('predictions')
          .delete()
          .eq('id', predictionId)

        if (error) throw error

        errorLogger.info({
          operation: 'DELETE',
          entity: 'predictions',
          message: 'Predicción eliminada',
          userId,
          metadata: { predictionId },
        })
      } catch (err: any) {
        errorLogger.error({
          operation: 'DELETE',
          entity: 'predictions',
          message: err.message || 'Error al eliminar predicción',
          statusCode: err.status || err.code,
          userId,
          metadata: { predictionId },
        })
        throw err
      }
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
