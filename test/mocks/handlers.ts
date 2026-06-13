import { http, HttpResponse } from 'msw'
import type { Match, Prediction } from '@/types'

// Mock data
const mockMatches: Match[] = [
  {
    id: 'match-1',
    match_number: 1,
    home_team_id: 'arg',
    away_team_id: 'bra',
    home_team_label: 'Argentina',
    away_team_label: 'Brazil',
    home_score: null,
    away_score: null,
    match_date: '2026-06-15T18:00:00Z',
    phase: 'group',
    group_name: 'Group A',
    stadium: 'Estadio Monumental',
    status: 'pending',
    is_locked: false,
  },
  {
    id: 'match-2',
    match_number: 2,
    home_team_id: 'ger',
    away_team_id: 'fra',
    home_team_label: 'Germany',
    away_team_label: 'France',
    home_score: 2,
    away_score: 1,
    match_date: '2026-06-14T15:00:00Z',
    phase: 'group',
    group_name: 'Group B',
    stadium: 'Allianz Arena',
    status: 'finished',
    is_locked: true,
  },
]

const mockPredictions: Prediction[] = [
  {
    id: 'pred-1',
    user_id: 'user-123',
    match_id: 'match-1',
    home_score: 2,
    away_score: 1,
    points_earned: 0,
    created_at: '2024-01-01T00:00:00Z',
  },
]

export const handlers = [
  // Mock Supabase auth endpoints
  http.get('https://*.supabase.co/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { username: 'Test User' },
    })
  }),

  http.post('https://*.supabase.co/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { username: 'Test User' },
      },
    })
  }),

  // Mock matches endpoint
  http.get('https://*.supabase.co/rest/v1/matches', () => {
    return HttpResponse.json(mockMatches)
  }),

  http.get('https://*.supabase.co/rest/v1/matches/:id', ({ params }) => {
    const match = mockMatches.find(m => m.id === params.id)
    return HttpResponse.json(match || null)
  }),

  // Mock predictions endpoint
  http.get('https://*.supabase.co/rest/v1/predictions', ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')?.eq
    
    if (userId) {
      const userPredictions = mockPredictions.filter(p => p.user_id === userId)
      return HttpResponse.json(userPredictions)
    }
    
    return HttpResponse.json(mockPredictions)
  }),

  http.post('https://*.supabase.co/rest/v1/predictions', async ({ request }) => {
    const prediction = await request.json() as Partial<Prediction>
    const newPrediction: Prediction = {
      id: `pred-${Date.now()}`,
      user_id: prediction.user_id || 'user-123',
      match_id: prediction.match_id || '',
      home_score: prediction.home_score || 0,
      away_score: prediction.away_score || 0,
      points_earned: 0,
      created_at: new Date().toISOString(),
    }
    
    mockPredictions.push(newPrediction)
    return HttpResponse.json(newPrediction, { status: 201 })
  }),

  http.patch('https://*.supabase.co/rest/v1/predictions/:id', async ({ params, request }) => {
    const updates = await request.json() as Partial<Prediction>
    const index = mockPredictions.findIndex(p => p.id === params.id)
    
    if (index !== -1) {
      mockPredictions[index] = { ...mockPredictions[index], ...updates }
      return HttpResponse.json(mockPredictions[index])
    }
    
    return HttpResponse.json(null, { status: 404 })
  }),

  // Mock leaderboard endpoint
  http.get('https://*.supabase.co/rest/v1/leaderboard_cache', () => {
    return HttpResponse.json([
      { user_id: 'user-123', username: 'Test User', total_points: 15, rank: 1 },
      { user_id: 'user-456', username: 'Other User', total_points: 12, rank: 2 },
    ])
  }),
]