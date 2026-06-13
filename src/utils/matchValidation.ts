/**
 * Centralized match validation utilities.
 * 
 * Guarantees consistency between client and server match-locking logic.
 * Business Rules (NON-NEGOTIABLE):
 * - Users CANNOT insert, update, or delete a prediction if 
 *   currentTime >= match_date
 * - Match locking also applies to non-pending status matches
 */
import { isMatchLocked as isMatchLockedCore, isValidPrediction as isValidPredictionCore } from '@/lib/scoring';
import type { Match } from '@/types';

// ─── Match Locking ─────────────────────────────────────────────

/**
 * Check if a match is locked for predictions.
 * Uses the core scoring function (source of truth) for consistency.
 * 
 * Lock conditions:
 *  1. Match status is not 'pending' (live or finished)
 *  2. Match date has passed (currentTime >= match_date)
 *  3. Match has explicit is_locked flag set to true
 */
export function isMatchLockedForPrediction(
  match: Pick<Match, 'match_date' | 'status' | 'is_locked'>,
  currentTime?: Date
): boolean {
  // Non-pending matches are always locked
  if (match.status !== 'pending') return true;
  
  // Explicit lock flag
  if (match.is_locked) return true;
  
  // Date-based check using centralized function
  return isMatchLockedCore(match.match_date, currentTime);
}

/**
 * Validate a match can still accept predictions.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateMatchForPrediction(
  match: Pick<Match, 'match_date' | 'status' | 'is_locked'>
): { valid: true } | { valid: false; reason: string } {
  if (match.status !== 'pending') {
    return { valid: false, reason: 'El partido ya no está pendiente' };
  }
  
  if (match.is_locked) {
    return { valid: false, reason: 'El partido está bloqueado' };
  }
  
  if (isMatchLockedCore(match.match_date)) {
    return { valid: false, reason: 'El partido ya ha comenzado' };
  }
  
  return { valid: true };
}

// ─── Prediction Validation ─────────────────────────────────────

/**
 * Validate a prediction payload against business rules.
 * Score boundaries: 0-99 (non-negative integers only)
 */
export function validatePredictionScores(
  homeScore: number,
  awayScore: number
): { valid: true } | { valid: false; reason: string } {
  if (!isValidPredictionCore(homeScore, awayScore)) {
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      return { valid: false, reason: 'Los goles deben ser números enteros' };
    }
    if (homeScore < 0 || awayScore < 0) {
      return { valid: false, reason: 'Los goles no pueden ser negativos' };
    }
    return { valid: false, reason: 'Goles inválidos (0-99)' };
  }
  
  return { valid: true };
}

/**
 * Full prediction validation: checks both match locking and score validity.
 */
export function validatePrediction(
  match: Pick<Match, 'match_date' | 'status' | 'is_locked'>,
  homeScore: number,
  awayScore: number
): { valid: true } | { valid: false; reason: string } {
  const matchCheck = validateMatchForPrediction(match);
  if (!matchCheck.valid) return matchCheck;
  
  const scoreCheck = validatePredictionScores(homeScore, awayScore);
  if (!scoreCheck.valid) return scoreCheck;
  
  return { valid: true };
}

// ─── Match Status Helpers ──────────────────────────────────────

/**
 * Get a human-readable label for a match status/lock combination.
 * Used for UI badges and accessibility labels.
 */
export function getMatchStatusLabel(
  match: Pick<Match, 'match_date' | 'status' | 'is_locked'>
): 'open' | 'locked' | 'live' | 'finished' {
  if (match.status === 'finished') return 'finished';
  if (match.status === 'live') return 'live';
  
  const locked = isMatchLockedForPrediction(match);
  return locked ? 'locked' : 'open';
}

/**
 * Determine if prediction inputs should be disabled for a match.
 */
export function shouldDisablePredictionInputs(
  match: Pick<Match, 'match_date' | 'status' | 'is_locked'>
): boolean {
  return isMatchLockedForPrediction(match);
}
