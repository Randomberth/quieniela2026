/** Core domain types for the World Cup 2026 Quiniela application */

// ─── Enums as string literal unions ───────────────────────────

export type MatchStatus = 'pending' | 'live' | 'finished';

export type MatchPhase =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter'
  | 'semi'
  | 'third_place'
  | 'final';

export type PreferredLanguage = 'es' | 'en';

// ─── Domain Entities ──────────────────────────────────────────

export interface Team {
  readonly id: string;
  name_es: string;
  name_en: string;
  code: string;
  group_name: string;
  flag_url: string | null;
}

export interface Match {
  readonly id: string;
  match_number: number;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team_label: string | null;
  away_team_label: string | null;
  /** Populated via Supabase join query */
  home_team?: Team;
  /** Populated via Supabase join query */
  away_team?: Team;
  match_date: string;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  phase: MatchPhase;
  group_name: string | null;
  stadium: string | null;
  /** Client-side computed field — set by useMatches hook */
  user_prediction?: Prediction;
  /** Client-side computed field — derived from match_date and status */
  is_locked: boolean;
}

export interface Prediction {
  readonly id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  /** Computed by database trigger/function */
  points_earned: number;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_points: number;
  exact_predictions: number;
  correct_tendencies: number;
  total_predictions: number;
  rank: number;
  last_updated: string;
}

export interface UserProfile {
  readonly id: string;
  username: string;
  full_name: string | null;
  preferred_language: PreferredLanguage;
  avatar_url: string | null;
}

// ─── Action Types ─────────────────────────────────────────────

/** Payload for saving a prediction */
export interface SavePredictionPayload {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

/** Return type from prediction save operation */
export interface SavePredictionResult {
  success: boolean;
  prediction?: Prediction;
  error?: string;
}

/** Auth operation result */
export interface AuthResult {
  success: boolean;
  user?: { id: string; email?: string };
  error?: string;
}

// ─── UI State Types ───────────────────────────────────────────

/** Generic loading/error state wrapper */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

/** Form submission state */
export interface FormSubmissionState {
  isSubmitting: boolean;
  hasChanges: boolean;
  lastSavedAt: Date | null;
  submitError: string | null;
}

// ─── Re-export type utils for convenience ─────────────────────

export type {
  NonNullFields,
  Immutable,
  AsyncResult,
  FieldValidation,
} from './utils';