import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePredictions } from '@/hooks/usePredictions'
import { isFeatureEnabled } from '@/config/feature-flags'

// Create wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    }))
  }
}))

// Mock feature flags
vi.mock('@/config/feature-flags', () => ({
  isFeatureEnabled: vi.fn(),
  getFeatureFlag: vi.fn(),
  getAllFeatureFlags: vi.fn(() => []),
}))

// Mock server action (simplified for testing)
vi.mock('@/actions/predictions', () => ({
  submitPredictionAction: vi.fn(),
}))

describe('usePredictions with Form Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use Form Actions when feature flag is enabled', () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true)

    const { result } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isFormActionsEnabled).toBe(true)
  })

  it('should not use Form Actions when feature flag is disabled', () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false)

    const { result } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isFormActionsEnabled).toBe(false)
  })

  it('should expose formAction function when feature flag is enabled', () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true)

    const { result } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    expect(typeof result.current.formAction).toBe('function')
    expect(result.current.isFormActionsEnabled).toBe(true)
  })

  it('should handle both isSaving states correctly', () => {
    // Test with Form Actions disabled
    vi.mocked(isFeatureEnabled).mockReturnValue(false)
    const { result: result1 } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })
    
    // Test with Form Actions enabled  
    vi.mocked(isFeatureEnabled).mockReturnValue(true)
    const { result: result2 } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    expect(typeof result1.current.isSaving).toBe('boolean')
    expect(typeof result2.current.isSaving).toBe('boolean')
  })

  it('should handle saveError based on Form Actions state', () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true)

    const { result } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    // With Form Actions enabled, saveError should handle formActionState messages
    expect(result.current.saveError).toBeDefined()
  })
})

describe('Form Actions Integration', () => {
  it('should maintain backward compatibility when feature flag is disabled', () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false)

    const { result } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    // Should still have traditional mutation methods
    expect(typeof result.current.savePrediction.mutate).toBe('function')
    expect(typeof result.current.savePrediction.mutateAsync).toBe('function')
    expect(result.current.isFormActionsEnabled).toBe(false)
  })

  it('should provide formAction when feature flag is enabled', () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true)

    const { result } = renderHook(() => usePredictions('user-123'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isFormActionsEnabled).toBe(true)
    expect(typeof result.current.formAction).toBe('function')
    expect(typeof result.current.formActionState).toBe('object')
    expect(typeof result.current.isFormActionPending).toBe('boolean')
  })
})