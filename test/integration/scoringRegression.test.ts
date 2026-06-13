/**
 * Integration regression tests for scoring and prediction flow (BUG-006).
 * 
 * Verifies:
 * - Scoring rules remain consistent (3-1-0)
 * - Prediction validation works end-to-end
 * - Match locking is consistent across all code paths
 */
import { describe, it, expect } from 'vitest';
import { calculatePoints, isMatchLocked, isValidPrediction } from '@/lib/scoring';
import {
  isMatchLockedForPrediction,
  validatePrediction,
  validateMatchForPrediction,
  validatePredictionScores,
} from '@/utils/matchValidation';

describe('scoring regression', () => {
  // ─── Scoring rules (non-negotiable) ───────────────────────

  describe('calculatePoints — 3-1-0 system', () => {
    it('awards 3 points for exact score match', () => {
      // Exact match
      expect(calculatePoints(2, 1, 2, 1)).toBe(3);
      // 0-0 exact
      expect(calculatePoints(0, 0, 0, 0)).toBe(3);
      // High score exact
      expect(calculatePoints(5, 3, 5, 3)).toBe(3);
    });

    it('awards 1 point for correct tendency (home win)', () => {
      // Predicted 1-0, actual 3-1 → still home win
      expect(calculatePoints(1, 0, 3, 1)).toBe(1);
      // Predicted 2-0, actual 1-0 → still home win
      expect(calculatePoints(2, 0, 1, 0)).toBe(1);
    });

    it('awards 1 point for correct tendency (draw)', () => {
      // Predicted 1-1, actual 2-2 → still draw
      expect(calculatePoints(1, 1, 2, 2)).toBe(1);
      // Predicted 0-0, actual 3-3 → still draw
      expect(calculatePoints(0, 0, 3, 3)).toBe(1);
    });

    it('awards 1 point for correct tendency (away win)', () => {
      // Predicted 0-1, actual 0-3 → still away win
      expect(calculatePoints(0, 1, 0, 3)).toBe(1);
    });

    it('awards 0 points for incorrect tendency', () => {
      // Predicted home win, actual away win
      expect(calculatePoints(2, 1, 1, 2)).toBe(0);
      // Predicted draw, actual home win
      expect(calculatePoints(1, 1, 2, 0)).toBe(0);
      // Predicted away win, actual home win
      expect(calculatePoints(0, 1, 3, 0)).toBe(0);
    });
  });

  // ─── Match locking consistency (BUG-003) ──────────────────

  describe('match locking consistency', () => {
    it('isMatchLocked (core) and isMatchLockedForPrediction (wrapper) agree', () => {
      const matchDate = '2026-06-15T20:00:00Z';
      const before = new Date('2026-06-15T19:00:00Z');

      // Both should return false for future date
      expect(isMatchLocked(matchDate, before)).toBe(false);
      expect(isMatchLockedForPrediction(
        { match_date: matchDate, status: 'pending', is_locked: false },
        before
      )).toBe(false);

      // Both should return true for past date
      const after = new Date('2026-06-15T21:00:00Z');
      expect(isMatchLocked(matchDate, after)).toBe(true);
      expect(isMatchLockedForPrediction(
        { match_date: matchDate, status: 'pending', is_locked: false },
        after
      )).toBe(true);
    });

    it('validateMatchForPrediction and isMatchLocked agree on status-based locking', () => {
      const liveMatch = { match_date: '2099-01-01T00:00:00Z', status: 'live' as const, is_locked: false };
      const result = validateMatchForPrediction(liveMatch);
      expect(result.valid).toBe(false);
      expect(isMatchLockedForPrediction(liveMatch)).toBe(true);
    });
  });

  // ─── Prediction validation (BUG-002 regression) ────────────

  describe('validatePrediction', () => {
    it('accepts valid prediction on open match', () => {
      const match = {
        match_date: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'pending' as const,
        is_locked: false,
      };

      const result = validatePrediction(match, 2, 1);
      expect(result.valid).toBe(true);
    });

    it('rejects prediction on locked match', () => {
      const match = {
        match_date: '2020-01-01T00:00:00Z',
        status: 'pending' as const,
        is_locked: false,
      };

      const result = validatePrediction(match, 2, 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('rejects prediction with invalid scores', () => {
      const match = {
        match_date: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'pending' as const,
        is_locked: false,
      };

      const result = validatePrediction(match, -1, 0);
      expect(result.valid).toBe(false);
    });
  });

  // ─── Input validation edge cases ──────────────────────────

  describe('isValidPrediction — boundary cases', () => {
    it('accepts boundary value 99', () => {
      expect(isValidPrediction(99, 99)).toBe(true);
    });

    it('accepts zero scores', () => {
      expect(isValidPrediction(0, 0)).toBe(true);
    });

    it('rejects negative scores', () => {
      expect(isValidPrediction(-1, 0)).toBe(false);
    });

    it('rejects non-integer scores', () => {
      expect(isValidPrediction(1.5, 2)).toBe(false);
      expect(isValidPrediction(1, 2.3)).toBe(false);
    });

    it('rejects NaN', () => {
      expect(isValidPrediction(NaN, 0)).toBe(false);
    });
  });
});