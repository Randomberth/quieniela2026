/**
 * Type utility helpers and type guards for runtime validation
 * of Supabase query results and API responses.
 */
import type { Match, Prediction, Team, UserProfile, LeaderboardEntry } from './index';

// ─── Type Guard Factories ─────────────────────────────────────

/** Validate that a value is a non-null object */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─── Match Type Guard ─────────────────────────────────────────

const VALID_MATCH_STATUSES = new Set(['pending', 'live', 'finished']);
const VALID_MATCH_PHASES = new Set([
  'group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final',
]);

export function isMatch(value: unknown): value is Match {
  if (!isRecord(value)) return false;

  const m = value as Record<string, unknown>;

  if (typeof m.id !== 'string') return false;
  if (typeof m.match_number !== 'number') return false;
  if (typeof m.match_date !== 'string') return false;
  // is_locked is a computed client-side field — allow boolean or undefined
  if (m.is_locked !== undefined && typeof m.is_locked !== 'boolean') return false;

  // home_score / away_score can be null (before match finishes)
  if (m.home_score !== null && m.home_score !== undefined && typeof m.home_score !== 'number') return false;
  if (m.away_score !== null && m.away_score !== undefined && typeof m.away_score !== 'number') return false;

  // status must be one of the valid set
  if (typeof m.status !== 'string' || !VALID_MATCH_STATUSES.has(m.status)) return false;

  // phase must be one of the valid set
  if (typeof m.phase !== 'string' || !VALID_MATCH_PHASES.has(m.phase)) return false;

  return true;
}

// ─── Prediction Type Guard ────────────────────────────────────

export function isPrediction(value: unknown): value is Prediction {
  if (!isRecord(value)) return false;

  const p = value as Record<string, unknown>;

  return (
    typeof p.id === 'string' &&
    typeof p.user_id === 'string' &&
    typeof p.match_id === 'string' &&
    typeof p.home_score === 'number' &&
    typeof p.away_score === 'number' &&
    typeof p.points_earned === 'number' &&
    typeof p.created_at === 'string'
  );
}

// ─── Team Type Guard ──────────────────────────────────────────

export function isTeam(value: unknown): value is Team {
  if (!isRecord(value)) return false;

  const t = value as Record<string, unknown>;

  return (
    typeof t.id === 'string' &&
    typeof t.name_es === 'string' &&
    typeof t.name_en === 'string' &&
    typeof t.code === 'string' &&
    typeof t.group_name === 'string'
    // flag_url can be string | null — intentionally permissive
  );
}

// ─── UserProfile Type Guard ───────────────────────────────────

const VALID_LANGUAGES = new Set(['es', 'en']);

export function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false;

  const p = value as Record<string, unknown>;

  if (typeof p.id !== 'string') return false;
  if (typeof p.username !== 'string') return false;

  // full_name can be null
  if (p.full_name !== null && p.full_name !== undefined && typeof p.full_name !== 'string') return false;

  if (typeof p.preferred_language !== 'string' || !VALID_LANGUAGES.has(p.preferred_language)) return false;

  // avatar_url can be null
  if (p.avatar_url !== null && p.avatar_url !== undefined && typeof p.avatar_url !== 'string') return false;

  return true;
}

// ─── LeaderboardEntry Type Guard ──────────────────────────────

export function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!isRecord(value)) return false;

  const e = value as Record<string, unknown>;

  return (
    typeof e.user_id === 'string' &&
    typeof e.username === 'string' &&
    typeof e.total_points === 'number' &&
    typeof e.exact_predictions === 'number' &&
    typeof e.correct_tendencies === 'number' &&
    typeof e.total_predictions === 'number' &&
    typeof e.rank === 'number' &&
    typeof e.last_updated === 'string'
  );
}

// ─── Array Type Guards (batch validation) ─────────────────────

export function isMatchArray(value: unknown): value is Match[] {
  return Array.isArray(value) && value.every(isMatch);
}

export function isPredictionArray(value: unknown): value is Prediction[] {
  return Array.isArray(value) && value.every(isPrediction);
}

export function isTeamArray(value: unknown): value is Team[] {
  return Array.isArray(value) && value.every(isTeam);
}

export function isLeaderboardEntryArray(value: unknown): value is LeaderboardEntry[] {
  return Array.isArray(value) && value.every(isLeaderboardEntry);
}

// ─── Safe Cast Helpers (for Supabase responses) ───────────────

/**
 * Safely cast an unknown Supabase response to Match[].
 * Returns the validated array or an empty array if validation fails.
 * Logs a warning to console on validation failure.
 */
export function safeCastMatches(data: unknown): Match[] {
  if (isMatchArray(data)) return data;
  console.warn('[TypeGuard] Match[] validation failed — returning empty array', data);
  return [];
}

/**
 * Safely cast an unknown Supabase response to Prediction[].
 */
export function safeCastPredictions(data: unknown): Prediction[] {
  if (isPredictionArray(data)) return data;
  console.warn('[TypeGuard] Prediction[] validation failed — returning empty array', data);
  return [];
}

/**
 * Safely cast an unknown Supabase response to Team[].
 */
export function safeCastTeams(data: unknown): Team[] {
  if (isTeamArray(data)) return data;
  console.warn('[TypeGuard] Team[] validation failed — returning empty array', data);
  return [];
}

/**
 * Safely cast an unknown Supabase response to LeaderboardEntry[].
 */
export function safeCastLeaderboard(data: unknown): LeaderboardEntry[] {
  if (isLeaderboardEntryArray(data)) return data;
  console.warn('[TypeGuard] LeaderboardEntry[] validation failed — returning empty array', data);
  return [];
}

// ─── Utility Types ────────────────────────────────────────────

/** Make properties K of T non-nullable */
export type NonNullFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};

/** Deeply mark all properties as readonly (shallow, 1 level) */
export type Immutable<T> = {
  readonly [P in keyof T]: T[P];
};

/** Extract success/error discriminated union from async operation */
export type AsyncResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Form field validation result */
export type FieldValidation = {
  valid: boolean;
  message?: string;
};
