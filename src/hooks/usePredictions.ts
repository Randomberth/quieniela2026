import { useActionState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import { safeCastPredictions } from '@/types/utils'
import { getSupabaseErrorMessage, getSupabaseStatusCode } from '@/types/supabase-augmented'
import { isMatchLockedForPrediction } from '@/utils/matchValidation'
import { isFeatureEnabled } from '@/config/feature-flags'
import { submitPredictionAction, type PredictionFormState } from '@/actions/predictions'
import type { Prediction } from '@/types'

export function usePredictions(userId?: string) {
  const queryClient = useQueryClient()
  const isFormActionsEnabled = isFeatureEnabled('react-19-form-actions')

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

        const validPredictions = safeCastPredictions(data)

        errorLogger.info({
          operation: 'READ',
          entity: 'predictions',
          message: `${validPredictions.length} predicciones cargadas`,
          userId,
        })

        return validPredictions
      } catch (err: unknown) {
        const message = getSupabaseErrorMessage(err)
        errorLogger.error({
          operation: 'READ',
          entity: 'predictions',
          message,
          statusCode: getSupabaseStatusCode(err),
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

  // React 19 Form Action state
  const [formActionState, formAction, isFormActionPending] = useActionState(
    submitPredictionAction,
    { success: false, message: '' } as PredictionFormState
  );

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

      // If Form Actions are enabled, use the new approach
      if (isFormActionsEnabled) {
        const formData = new FormData()
        formData.append('matchId', matchId)
        formData.append('userId', userId)
        formData.append('homeScore', homeScore.toString())
        formData.append('awayScore', awayScore.toString())

        // This will trigger the form action
        await formAction(formData)
        return null // Form action handles state separately
      }

      // Fallback to traditional mutation
      // Server-side check: read match and lock status atomically
      const { data: match } = await supabase
        .from('matches')
        .select('match_date, status')
        .eq('id', matchId)
        .single()

      if (!match) throw new Error('Partido no encontrado')

      // Use centralized match locking (same function as client-side)
      if (isMatchLockedForPrediction({
        match_date: match.match_date,
        status: match.status,
        is_locked: false // server check only — DB handles is_locked via trigger
      })) {
        throw new Error('El partido ya ha comenzado o está bloqueado')
      }

      try {
        // Use upsert to avoid race conditions — the database handles
        // atomic insert-or-update via the (user_id, match_id) unique constraint.
        // This eliminates the check-then-act race condition.
        const result = await supabase
          .from('predictions')
          .upsert({
            user_id: userId,
            match_id: matchId,
            home_score: homeScore,
            away_score: awayScore,
          }, {
            onConflict: 'user_id,match_id',
          })
          .select()
          .single()

        if (result.error) throw result.error

        const savedPrediction = result.data as Prediction

        errorLogger.info({
          operation: 'CREATE',
          entity: 'predictions',
          message: 'Predicción guardada (upsert)',
          userId,
          metadata: { matchId, homeScore, awayScore },
        })

        return savedPrediction
      } catch (err: unknown) {
        const message = getSupabaseErrorMessage(err)
        errorLogger.error({
          operation: 'CREATE',
          entity: 'predictions',
          message,
          statusCode: getSupabaseStatusCode(err),
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
      } catch (err: unknown) {
        const message = getSupabaseErrorMessage(err)
        errorLogger.error({
          operation: 'DELETE',
          entity: 'predictions',
          message,
          statusCode: getSupabaseStatusCode(err),
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
    isSaving: isFormActionsEnabled ? isFormActionPending : savePrediction.isPending,
    isDeleting: deletePrediction.isPending,
    saveError: isFormActionsEnabled ? (formActionState.success ? null : formActionState.message) : savePrediction.error,
    deleteError: deletePrediction.error,
    // Form Actions specific
    isFormActionsEnabled,
    formActionState,
    formAction,
    isFormActionPending,
  }
}