/**
 * Augmented Supabase client typings.
 * Provides stricter types for the database schema.
 */
import type { Database } from '@/lib/supabase';

// ─── Table Row Types ───────────────────────────────────────────

export type MatchRow = Database['public']['Tables']['matches']['Row'];
export type PredictionRow = Database['public']['Tables']['predictions']['Row'];
export type TeamRow = Database['public']['Tables']['teams']['Row'];
export type LeaderboardCacheRow = Database['public']['Tables']['leaderboard_cache']['Row'];

// ─── Query Result Helpers ─────────────────────────────────────

/** Standard Supabase query error shape */
export interface SupabaseQueryError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/** Wrapper type for a Supabase select result with potential embedded joins */
export type SupabaseSelectResult<T> = T | null;

/** Narrow Supabase error to a string message */
export function getSupabaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return typeof err.message === 'string' ? err.message : 'Unknown database error';
  }
  return 'Unknown database error';
}

/** Extract status code from a Supabase error or thrown object */
export function getSupabaseStatusCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.status === 'number') return err.status;
    if (typeof err.code === 'string') {
      const num = parseInt(err.code, 10);
      if (!isNaN(num)) return num;
    }
  }
  return undefined;
}
