import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { errorLogger } from '@/lib/logger'
import { submitPredictionAction } from '@/actions/predictions'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}))

vi.mock('@/lib/logger', () => ({
  errorLogger: {
    error: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('@/utils/matchValidation', () => ({
  validatePredictionScores: vi.fn(),
  isMatchLockedForPrediction: vi.fn()
}))

vi.mock('@/types/supabase-augmented', () => ({
  getSupabaseErrorMessage: vi.fn(() => 'Test error'),
  getSupabaseStatusCode: vi.fn(() => 500)
}))

describe('submitPredictionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should validate required fields', async () => {
    const formData = new FormData()
    // Missing required fields

    const result = await submitPredictionAction(
      { success: false, message: '' },
      formData
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('incompletos')
  })

  it('should handle invalid score validation', async () => {
    const { validatePredictionScores } = await import('@/utils/matchValidation')
    vi.mocked(validatePredictionScores).mockReturnValue({ 
      valid: false, 
      message: 'Puntuación inválida' 
    })

    const formData = new FormData()
    formData.append('matchId', 'match-123')
    formData.append('userId', 'user-123')
    formData.append('homeScore', '-1')
    formData.append('awayScore', '101')

    const result = await submitPredictionAction(
      { success: false, message: '' },
      formData
    )

    expect(result.success).toBe(false)
    expect(result.message).toBe('Puntuación inválida')
  })

  it('should check match locking', async () => {
    const { isMatchLockedForPrediction } = await import('@/utils/matchValidation')
    vi.mocked(isMatchLockedForPrediction).mockReturnValue(true)

    // Mock match fetch
    const mockSingle = vi.fn().mockResolvedValue({ 
      data: { 
        match_date: new Date().toISOString(), 
        status: 'finished' 
      }, 
      error: null 
    })
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle
        }))
      }))
    } as any)

    const formData = new FormData()
    formData.append('matchId', 'match-123')
    formData.append('userId', 'user-123')
    formData.append('homeScore', '2')
    formData.append('awayScore', '1')

    const result = await submitPredictionAction(
      { success: false, message: '' },
      formData
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('comenzado')
  })

  it('should handle successful prediction save', async () => {
    const { validatePredictionScores } = await import('@/utils/matchValidation')
    const { isMatchLockedForPrediction } = await import('@/utils/matchValidation')
    
    vi.mocked(validatePredictionScores).mockReturnValue({ valid: true })
    vi.mocked(isMatchLockedForPrediction).mockReturnValue(false)

    // Mock successful upsert
    const mockSingle = vi.fn().mockResolvedValue({ 
      data: { id: 'pred-123' }, 
      error: null 
    })
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ 
            data: { 
              match_date: new Date(Date.now() + 86400000).toISOString(), 
              status: 'pending' 
            }, 
            error: null 
          })
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mockSingle
        }))
      }))
    } as any)

    const formData = new FormData()
    formData.append('matchId', 'match-123')
    formData.append('userId', 'user-123')
    formData.append('homeScore', '2')
    formData.append('awayScore', '1')

    const result = await submitPredictionAction(
      { success: false, message: '' },
      formData
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain('guardada')
  })

  it('should handle Supabase errors', async () => {
    const { validatePredictionScores } = await import('@/utils/matchValidation')
    const { isMatchLockedForPrediction } = await import('@/utils/matchValidation')
    
    vi.mocked(validatePredictionScores).mockReturnValue({ valid: true })
    vi.mocked(isMatchLockedForPrediction).mockReturnValue(false)

    // Mock error response
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ 
            data: { 
              match_date: new Date(Date.now() + 86400000).toISOString(), 
              status: 'pending' 
            }, 
            error: null 
          })
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockRejectedValue(new Error('Database error'))
        }))
      }))
    } as any)

    const formData = new FormData()
    formData.append('matchId', 'match-123')
    formData.append('userId', 'user-123')
    formData.append('homeScore', '2')
    formData.append('awayScore', '1')

    const result = await submitPredictionAction(
      { success: false, message: '' },
      formData
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('Error')
  })
})