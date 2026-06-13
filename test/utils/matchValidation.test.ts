/**
 * Tests for centralized match validation (BUG-001, BUG-003)
 * Verifies consistency between client and server locking logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMatchLockedForPrediction,
  validateMatchForPrediction,
  validatePredictionScores,
  validatePrediction,
  getMatchStatusLabel,
  shouldDisablePredictionInputs,
} from '@/utils/matchValidation';

describe('matchValidation', () => {
  // ─── Helper: create a mock match ────────────────────────

  const makeMatch = (overrides: Partial<{
    match_date: string;
    status: string;
    is_locked: boolean;
  }> = {}) => ({
    match_date: overrides.match_date ?? new Date(Date.now() + 3600_000).toISOString(),
    status: overrides.status ?? ('pending' as const),
    is_locked: overrides.is_locked ?? false,
  });

  // ─── BUG-003: Consistent currentTime >= match_date validation

  describe('isMatchLockedForPrediction', () => {
    it('locks when match status is not pending', () => {
      const live = makeMatch({ status: 'live' });
      const finished = makeMatch({ status: 'finished' });

      expect(isMatchLockedForPrediction(live)).toBe(true);
      expect(isMatchLockedForPrediction(finished)).toBe(true);
    });

    it('locks when is_locked flag is true', () => {
      const locked = makeMatch({ is_locked: true });
      expect(isMatchLockedForPrediction(locked)).toBe(true);
    });

    it('locks when match_date is in the past', () => {
      const pastMatch = makeMatch({
        match_date: '2020-01-01T00:00:00Z',
      });
      expect(isMatchLockedForPrediction(pastMatch)).toBe(true);
    });

    it('does not lock when match is pending, not flagged, and in the future', () => {
      const futureMatch = makeMatch({
        match_date: new Date(Date.now() + 86_400_000).toISOString(), // 24h from now
      });
      expect(isMatchLockedForPrediction(futureMatch)).toBe(false);
    });

    it('respects custom currentTime (for deterministic testing)', () => {
      const match = makeMatch({
        match_date: '2026-06-15T20:00:00Z',
      });

      // Before match start
      const before = new Date('2026-06-15T19:00:00Z');
      expect(isMatchLockedForPrediction(match, before)).toBe(false);

      // At match start (equal)
      const at = new Date('2026-06-15T20:00:00Z');
      expect(isMatchLockedForPrediction(match, at)).toBe(true);

      // After match start
      const after = new Date('2026-06-15T21:00:00Z');
      expect(isMatchLockedForPrediction(match, after)).toBe(true);
    });

    it('locks on exact match_date boundary (>= semantics)', () => {
      const match = makeMatch({
        match_date: '2026-06-15T20:00:00Z',
      });
      // currentTime >= match_date → locked
      const exactMoment = new Date('2026-06-15T20:00:00.000Z');
      expect(isMatchLockedForPrediction(match, exactMoment)).toBe(true);
    });
  });

  // ─── validateMatchForPrediction ──────────────────────────

  describe('validateMatchForPrediction', () => {
    it('returns { valid: true } for pending future match', () => {
      const match = makeMatch({
        match_date: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(validateMatchForPrediction(match)).toEqual({ valid: true });
    });

    it('returns reason when match is not pending', () => {
      const live = makeMatch({ status: 'live' });
      const result = validateMatchForPrediction(live);
      expect(result).toHaveProperty('valid', false);
      expect(result).toHaveProperty('reason');
    });

    it('returns reason when match is locked past date', () => {
      const past = makeMatch({ match_date: '2020-01-01T00:00:00Z' });
      const result = validateMatchForPrediction(past);
      expect(result).toHaveProperty('valid', false);
    });
  });

  // ─── validatePredictionScores ────────────────────────────

  describe('validatePredictionScores', () => {
    it('accepts valid non-negative integers', () => {
      expect(validatePredictionScores(0, 0)).toEqual({ valid: true });
      expect(validatePredictionScores(1, 2)).toEqual({ valid: true });
      expect(validatePredictionScores(5, 0)).toEqual({ valid: true });
      expect(validatePredictionScores(99, 99)).toEqual({ valid: true });
    });

    it('rejects negative scores', () => {
      const result = validatePredictionScores(-1, 0);
      expect(result).toHaveProperty('valid', false);
      expect(result).toHaveProperty('reason', 'Los goles no pueden ser negativos');
    });

    it('rejects non-integer scores', () => {
      const result = validatePredictionScores(1.5, 2);
      expect(result).toHaveProperty('valid', false);
      expect(result).toHaveProperty('reason', 'Los goles deben ser números enteros');
    });
  });

  // ─── validatePrediction (combined) ───────────────────────

  describe('validatePrediction', () => {
    it('passes when match is open and scores are valid', () => {
      const match = makeMatch();
      expect(validatePrediction(match, 2, 1)).toEqual({ valid: true });
    });

    it('fails when match is locked', () => {
      const match = makeMatch({ status: 'live' });
      const result = validatePrediction(match, 2, 1);
      expect(result.valid).toBe(false);
    });

    it('fails when scores are invalid', () => {
      const match = makeMatch();
      const result = validatePrediction(match, -1, 0);
      expect(result.valid).toBe(false);
    });
  });

  // ─── getMatchStatusLabel ─────────────────────────────────

  describe('getMatchStatusLabel', () => {
    it('returns finished for finished matches', () => {
      const match = makeMatch({ status: 'finished' });
      expect(getMatchStatusLabel(match)).toBe('finished');
    });

    it('returns live for live matches', () => {
      const match = makeMatch({ status: 'live' });
      expect(getMatchStatusLabel(match)).toBe('live');
    });

    it('returns open for pending future matches', () => {
      const match = makeMatch({
        match_date: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(getMatchStatusLabel(match)).toBe('open');
    });

    it('returns locked for pending past matches', () => {
      const match = makeMatch({
        match_date: '2020-01-01T00:00:00Z',
      });
      expect(getMatchStatusLabel(match)).toBe('locked');
    });
  });

  // ─── shouldDisablePredictionInputs ───────────────────────

  describe('shouldDisablePredictionInputs', () => {
    it('returns false for open matches', () => {
      const match = makeMatch({
        match_date: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(shouldDisablePredictionInputs(match)).toBe(false);
    });

    it('returns true for locked matches', () => {
      const match = makeMatch({ status: 'live' });
      expect(shouldDisablePredictionInputs(match)).toBe(true);
    });
  });
});
