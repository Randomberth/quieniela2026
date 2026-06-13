'use client';

import { supabase } from '@/lib/supabase';
import { errorLogger } from '@/lib/logger';
import { getSupabaseErrorMessage, getSupabaseStatusCode } from '@/types/supabase-augmented';
import { validatePredictionScores, isMatchLockedForPrediction } from '@/utils/matchValidation';

export type PredictionFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  matchId?: string;
  userId?: string;
};

export async function submitPredictionAction(
  _prevState: PredictionFormState,
  formData: FormData
): Promise<PredictionFormState> {
  'use server';

  try {
    const matchId = formData.get('matchId') as string;
    const userId = formData.get('userId') as string;
    const homeScore = parseInt(formData.get('homeScore') as string, 10);
    const awayScore = parseInt(formData.get('awayScore') as string, 10);

    // Validate required fields
    if (!matchId || !userId || isNaN(homeScore) || isNaN(awayScore)) {
      return {
        success: false,
        message: 'Datos incompletos. Verifique la información.',
        matchId,
        userId,
      };
    }

    // Client-side validation (score range)
    const scoreValidation = validatePredictionScores(homeScore, awayScore);
    if (!scoreValidation.valid) {
      return {
        success: false,
        message: scoreValidation.reason || 'Puntuación inválida',
        matchId,
        userId,
      };
    }

    // Server-side match locking check
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('match_date, status')
      .eq('id', matchId)
      .single();

    if (matchError) {
      errorLogger.error({
        operation: 'READ',
        entity: 'matches',
        message: getSupabaseErrorMessage(matchError),
        statusCode: getSupabaseStatusCode(matchError),
        userId,
        metadata: { matchId },
      });

      return {
        success: false,
        message: 'Partido no encontrado',
        matchId,
        userId,
      };
    }

    // Check if match is locked for prediction
    if (isMatchLockedForPrediction({
      match_date: match.match_date,
      status: match.status,
      is_locked: false,
    })) {
      return {
        success: false,
        message: 'El partido ya ha comenzado o está bloqueado',
        matchId,
        userId,
      };
    }

    // Atomic upsert to avoid race conditions
    const { data: _data, error } = await supabase
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
      .single();

    if (error) {
      errorLogger.error({
        operation: 'UPSERT',
        entity: 'predictions',
        message: getSupabaseErrorMessage(error),
        statusCode: getSupabaseStatusCode(error),
        userId,
        metadata: { matchId, homeScore, awayScore },
      });

      return {
        success: false,
        message: 'Error al guardar la predicción',
        matchId,
        userId,
      };
    }

    errorLogger.info({
      operation: 'UPSERT',
      entity: 'predictions',
      message: 'Predicción guardada exitosamente con Form Actions',
      userId,
      metadata: { matchId, homeScore, awayScore },
    });

    return {
      success: true,
      message: '¡Predicción guardada!',
      matchId,
      userId,
    };
  } catch (error: unknown) {
    errorLogger.error({
      operation: 'FORM_ACTION',
      entity: 'predictions',
      message: 'Error inesperado en Form Action',
      statusCode: getSupabaseStatusCode(error),
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    return {
      success: false,
      message: 'Error inesperado. Intente nuevamente.',
    };
  }
}