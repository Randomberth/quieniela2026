import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

// Types exportados para uso en toda la app
export type Database = {
  public: {
    Tables: {
      matches: {
        Row: {
          id: string
          match_number: number
          home_team_id: string | null
          away_team_id: string | null
          home_team_label: string | null
          away_team_label: string | null
          match_date: string
          home_score: number | null
          away_score: number | null
          status: 'pending' | 'live' | 'finished'
          phase: 'group' | 'round_of_32' | 'round_of_16' | 'quarter' | 'semi' | 'third_place' | 'final'
          group_name: string | null
          stadium: string | null
        }
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: string
          home_score: number
          away_score: number
          points_earned: number
          created_at: string
        }
      }
      teams: {
        Row: {
          id: string
          name_es: string
          name_en: string
          code: string
          group_name: string
          flag_url: string | null
        }
      }
      leaderboard_cache: {
        Row: {
          user_id: string
          username: string
          total_points: number
          exact_predictions: number
          correct_tendencies: number
          total_predictions: number
          rank: number
          last_updated: string
        }
      }
    }
  }
}
