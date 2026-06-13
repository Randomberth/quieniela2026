import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculatePoints, isMatchLocked, isValidPrediction } from '@/lib/scoring'

describe('Scoring Utilities', () => {
  describe('calculatePoints', () => {
    it('should return 3 points for exact match', () => {
      expect(calculatePoints(2, 1, 2, 1)).toBe(3) // 2-1 vs 2-1
      expect(calculatePoints(0, 0, 0, 0)).toBe(3) // 0-0 vs 0-0
      expect(calculatePoints(4, 2, 4, 2)).toBe(3) // 4-2 vs 4-2
    })

    it('should return 1 point for correct tendency but wrong score', () => {
      // Home win predictions
      expect(calculatePoints(1, 0, 3, 1)).toBe(1) // 1-0 vs 3-1 (both home win)
      expect(calculatePoints(2, 1, 1, 0)).toBe(1) // 2-1 vs 1-0 (both home win)
      
      // Away win predictions
      expect(calculatePoints(0, 1, 1, 3)).toBe(1) // 0-1 vs 1-3 (both away win)
      expect(calculatePoints(1, 2, 0, 1)).toBe(1) // 1-2 vs 0-1 (both away win)
      
      // Draw predictions
      expect(calculatePoints(1, 1, 2, 2)).toBe(1) // 1-1 vs 2-2 (both draw)
      expect(calculatePoints(0, 0, 3, 3)).toBe(1) // 0-0 vs 3-3 (both draw)
    })

    it('should return 0 points for incorrect tendency', () => {
      // Predicted home win, actual away win
      expect(calculatePoints(2, 1, 1, 2)).toBe(0) // 2-1 vs 1-2
      
      // Predicted away win, actual home win
      expect(calculatePoints(1, 2, 2, 1)).toBe(0) // 1-2 vs 2-1
      
      // Predicted draw, actual home win
      expect(calculatePoints(1, 1, 2, 1)).toBe(0) // 1-1 vs 2-1
      
      // Predicted home win, actual draw
      expect(calculatePoints(2, 1, 1, 1)).toBe(0) // 2-1 vs 1-1
    })

    it('should handle edge cases', () => {
      // High scores
      expect(calculatePoints(5, 3, 5, 3)).toBe(3)
      expect(calculatePoints(5, 3, 6, 2)).toBe(1) // Both home wins
      expect(calculatePoints(5, 3, 3, 5)).toBe(0)
      
      // Negative scores (not valid but function should handle)
      expect(calculatePoints(-1, 2, -1, 2)).toBe(3) // Exact match
    })
  })

  describe('isMatchLocked', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return false when current time is before match date', () => {
      const matchDate = '2026-06-15T18:00:00Z'
      const currentTime = new Date('2026-06-15T17:59:59Z')
      
      vi.setSystemTime(currentTime)
      expect(isMatchLocked(matchDate)).toBe(false)
    })

    it('should return true when current time equals match date', () => {
      const matchDate = '2026-06-15T18:00:00Z'
      const currentTime = new Date('2026-06-15T18:00:00Z')
      
      vi.setSystemTime(currentTime)
      expect(isMatchLocked(matchDate)).toBe(true)
    })

    it('should return true when current time is after match date', () => {
      const matchDate = '2026-06-15T18:00:00Z'
      const currentTime = new Date('2026-06-15T18:00:01Z')
      
      vi.setSystemTime(currentTime)
      expect(isMatchLocked(matchDate)).toBe(true)
    })

    it('should accept custom current time for testing', () => {
      const matchDate = '2026-06-15T18:00:00Z'
      const customTime = new Date('2026-06-14T12:00:00Z')
      
      expect(isMatchLocked(matchDate, customTime)).toBe(false)
    })
  })

  describe('isValidPrediction', () => {
    it('should return true for valid non-negative integer scores', () => {
      expect(isValidPrediction(0, 0)).toBe(true)
      expect(isValidPrediction(1, 0)).toBe(true)
      expect(isValidPrediction(0, 1)).toBe(true)
      expect(isValidPrediction(5, 3)).toBe(true)
      expect(isValidPrediction(99, 99)).toBe(true)
    })

    it('should return false for negative scores', () => {
      expect(isValidPrediction(-1, 0)).toBe(false)
      expect(isValidPrediction(0, -1)).toBe(false)
      expect(isValidPrediction(-1, -1)).toBe(false)
    })

    it('should return false for non-integer scores', () => {
      expect(isValidPrediction(1.5, 0)).toBe(false)
      expect(isValidPrediction(0, 2.7)).toBe(false)
      expect(isValidPrediction(1.1, 2.2)).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isValidPrediction(Number.MAX_SAFE_INTEGER, 0)).toBe(true)
      expect(isValidPrediction(0, Number.MAX_SAFE_INTEGER)).toBe(true)
    })
  })
})