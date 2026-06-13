/**
 * Tests for type guards and type utilities (TS-004, TS-006)
 */
import { describe, it, expect } from 'vitest';
import {
  isMatch,
  isPrediction,
  isTeam,
  isUserProfile,
  isLeaderboardEntry,
  isMatchArray,
  isPredictionArray,
  isTeamArray,
  isLeaderboardEntryArray,
  safeCastMatches,
  safeCastPredictions,
  safeCastTeams,
  safeCastLeaderboard,
} from '@/types/utils';

describe('type guards', () => {
  const validMatch = {
    id: 'm1',
    match_number: 1,
    match_date: '2026-06-15T20:00:00Z',
    home_score: null,
    away_score: null,
    status: 'pending' as const,
    phase: 'group' as const,
    home_team_id: 't1',
    away_team_id: 't2',
    home_team_label: 'Argentina',
    away_team_label: 'Brasil',
    group_name: 'A',
    stadium: 'Lusail',
    is_locked: false,
  };

  const validPrediction = {
    id: 'p1',
    user_id: 'u1',
    match_id: 'm1',
    home_score: 2,
    away_score: 1,
    points_earned: 0,
    created_at: '2026-06-14T10:00:00Z',
  };

  const validTeam = {
    id: 't1',
    name_es: 'Argentina',
    name_en: 'Argentina',
    code: 'ARG',
    group_name: 'A',
    flag_url: null,
  };

  const validProfile = {
    id: 'u1',
    username: 'pepe',
    full_name: null,
    preferred_language: 'es' as const,
    avatar_url: null,
  };

  const validLeaderboardEntry = {
    user_id: 'u1',
    username: 'pepe',
    total_points: 6,
    exact_predictions: 2,
    correct_tendencies: 0,
    total_predictions: 10,
    rank: 1,
    last_updated: '2026-06-15T10:00:00Z',
  };

  describe('isMatch', () => {
    it('accepts a valid match', () => {
      expect(isMatch(validMatch)).toBe(true);
    });

    it('rejects null', () => {
      expect(isMatch(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isMatch(undefined)).toBe(false);
    });

    it('rejects plain object with missing fields', () => {
      expect(isMatch({})).toBe(false);
      expect(isMatch({ id: 'x' })).toBe(false);
    });

    it('rejects array', () => {
      expect(isMatch([])).toBe(false);
    });

    it('rejects string', () => {
      expect(isMatch('not a match')).toBe(false);
    });
  });

  describe('isPrediction', () => {
    it('accepts a valid prediction', () => {
      expect(isPrediction(validPrediction)).toBe(true);
    });

    it('rejects null', () => {
      expect(isPrediction(null)).toBe(false);
    });

    it('rejects object with wrong types', () => {
      const bad = { ...validPrediction, home_score: 'two' };
      expect(isPrediction(bad)).toBe(false);
    });

    it('rejects missing fields', () => {
      expect(isPrediction({ id: 'x' })).toBe(false);
    });
  });

  describe('isTeam', () => {
    it('accepts a valid team', () => {
      expect(isTeam(validTeam)).toBe(true);
    });

    it('accepts team with flag_url as string', () => {
      expect(isTeam({ ...validTeam, flag_url: 'https://example.com/flag.png' })).toBe(true);
    });

    it('rejects null', () => {
      expect(isTeam(null)).toBe(false);
    });
  });

  describe('isUserProfile', () => {
    it('accepts valid profile', () => {
      expect(isUserProfile(validProfile)).toBe(true);
    });

    it('rejects invalid language', () => {
      expect(isUserProfile({ ...validProfile, preferred_language: 'fr' })).toBe(false);
    });

    it('rejects missing username', () => {
      expect(isUserProfile({ id: 'x', preferred_language: 'es' })).toBe(false);
    });
  });

  describe('isLeaderboardEntry', () => {
    it('accepts valid entry', () => {
      expect(isLeaderboardEntry(validLeaderboardEntry)).toBe(true);
    });

    it('rejects non-object', () => {
      expect(isLeaderboardEntry(42)).toBe(false);
    });

    it('rejects entry with wrong rank type', () => {
      const bad = { ...validLeaderboardEntry, rank: 'first' };
      expect(isLeaderboardEntry(bad)).toBe(false);
    });
  });

  describe('array type guards', () => {
    it('isMatchArray validates array of valid matches', () => {
      expect(isMatchArray([validMatch, validMatch])).toBe(true);
    });

    it('isMatchArray rejects mixed array', () => {
      expect(isMatchArray([validMatch, null])).toBe(false);
    });

    it('isMatchArray rejects empty non-array', () => {
      expect(isMatchArray({})).toBe(false);
    });

    it('isPredictionArray validates valid predictions', () => {
      expect(isPredictionArray([validPrediction])).toBe(true);
    });

    it('isTeamArray validates valid teams', () => {
      expect(isTeamArray([validTeam])).toBe(true);
    });

    it('isLeaderboardEntryArray validates valid entries', () => {
      expect(isLeaderboardEntryArray([validLeaderboardEntry])).toBe(true);
    });
  });

  describe('safeCastMatches', () => {
    it('returns validated array when valid', () => {
      const result = safeCastMatches([validMatch]);
      expect(result).toHaveLength(1);
    });

    it('returns empty array on null', () => {
      const result = safeCastMatches(null);
      expect(result).toEqual([]);
    });

    it('returns empty array on invalid data', () => {
      const result = safeCastMatches([{ id: 'x' }]);
      expect(result).toEqual([]);
    });
  });

  describe('safeCastPredictions', () => {
    it('returns validated array', () => {
      const result = safeCastPredictions([validPrediction]);
      expect(result).toHaveLength(1);
    });

    it('returns empty on null', () => {
      expect(safeCastPredictions(null)).toEqual([]);
    });
  });

  describe('safeCastTeams', () => {
    it('returns validated array', () => {
      const result = safeCastTeams([validTeam]);
      expect(result).toHaveLength(1);
    });

    it('returns empty on null', () => {
      expect(safeCastTeams(null)).toEqual([]);
    });
  });

  describe('safeCastLeaderboard', () => {
    it('returns validated array', () => {
      const result = safeCastLeaderboard([validLeaderboardEntry]);
      expect(result).toHaveLength(1);
    });

    it('returns empty on null', () => {
      expect(safeCastLeaderboard(null)).toEqual([]);
    });
  });
});
