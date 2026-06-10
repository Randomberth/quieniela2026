// Types de la aplicación
export interface Team {
  id: string
  name_es: string
  name_en: string
  code: string
  group_name: string
  flag_url: string | null
}

export interface Match {
  id: string
  match_number: number
  home_team_id: string | null
  away_team_id: string | null
  home_team_label: string | null
  away_team_label: string | null
  home_team?: Team
  away_team?: Team
  match_date: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  phase: 'group' | 'round_of_32' | 'round_of_16' | 'quarter' | 'semi' | 'third_place' | 'final'
  group_name: string | null
  stadium: string | null
  user_prediction?: Prediction
  is_locked: boolean
}

export interface Prediction {
  id: string
  user_id: string
  match_id: string
  home_score: number
  away_score: number
  points_earned: number
  created_at: string
}

export interface LeaderboardEntry {
  user_id: string
  username: string
  total_points: number
  exact_predictions: number
  correct_tendencies: number
  total_predictions: number
  rank: number
  last_updated: string
}

export interface UserProfile {
  id: string
  username: string
  full_name: string | null
  preferred_language: 'es' | 'en'
  avatar_url: string | null
}
