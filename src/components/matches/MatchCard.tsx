import { useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Trophy, AlertCircle, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { shouldDisablePredictionInputs, validatePredictionScores } from '@/utils/matchValidation'
import { isFeatureEnabled } from '@/config/feature-flags'
import type { Match } from '@/types'
import type { Prediction } from '@/types'

interface MatchCardProps {
  match: Match
  prediction?: Prediction
  onSavePrediction?: (matchId: string, homeScore: number, awayScore: number) => void
  userId?: string
  compact?: boolean
  formAction?: (formData: FormData) => void
  isFormActionPending?: boolean
}

export function MatchCard({ 
  match, 
  prediction, 
  onSavePrediction, 
  userId,
  compact = false,
  formAction,
  isFormActionPending = false
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState<string>(prediction?.home_score?.toString() || '')
  const [awayScore, setAwayScore] = useState<string>(prediction?.away_score?.toString() || '')
  const [hasChanges, setHasChanges] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  
  const isFormActionsEnabled = isFeatureEnabled('react-19-form-actions')
  const isUsingFormActions = isFormActionsEnabled && !!formAction

  // Check if match is locked (centralized validation)
  const isLocked = useMemo(() => {
    return shouldDisablePredictionInputs(match);
  }, [match.status, match.is_locked, match.match_date]);

  // Check if prediction exists
  const hasPrediction = !!prediction && prediction.home_score !== undefined

  // Handle score changes
  const handleHomeScoreChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10)
    if (value === '' || (numValue >= 0 && numValue <= 99)) {
      setHomeScore(value)
      setHasChanges(true)
    }
  }, [])

  const handleAwayScoreChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10)
    if (value === '' || (numValue >= 0 && numValue <= 99)) {
      setAwayScore(value)
      setHasChanges(true)
    }
  }, [])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!userId || isLocked) return
    
    const home = parseInt(homeScore, 10)
    const away = parseInt(awayScore, 10)
    
    const scoreCheck = validatePredictionScores(home, away)
    if (!scoreCheck.valid) return

    // If using Form Actions, submit via form
    if (isUsingFormActions && formAction) {
      const formData = new FormData()
      formData.append('matchId', match.id)
      formData.append('userId', userId)
      formData.append('homeScore', homeScore)
      formData.append('awayScore', awayScore)
      formAction(formData)
      return
    }

    // Traditional approach
    if (!onSavePrediction) return
    
    setIsSubmitting(true)
    try {
      await onSavePrediction(match.id, home, away)
      setHasChanges(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [onSavePrediction, match.id, homeScore, awayScore, userId, isLocked, isUsingFormActions, formAction])

  // Get status badge
  const getStatusBadge = () => {
    switch (match.status) {
      case 'live':
        return <Badge variant="destructive" className="animate-pulse">EN VIVO</Badge>
      case 'finished':
        return <Badge variant="secondary">FINALIZADO</Badge>
      case 'pending':
      default:
        return isLocked ? (
          <Badge variant="outline" className="text-gray-500">
            <Lock className="w-3 h-3 mr-1" />
            BLOQUEADO
          </Badge>
        ) : (
          <Badge variant="outline" className="text-green-600">
            <Unlock className="w-3 h-3 mr-1" />
            ABIERTO
          </Badge>
        )
    }
  }

  // Combined submission state
  const submissionState = isUsingFormActions ? isFormActionPending : isSubmitting

  // Get points display
  const getPointsDisplay = () => {
    if (!hasPrediction || match.status === 'pending') return null
    
    const points = prediction?.points_earned ?? 0
    const isExact = points === 3
    const isTendency = points === 1

    return (
      <div className={cn(
        "flex items-center gap-1 text-sm font-bold",
        isExact ? "text-green-600" : isTendency ? "text-yellow-600" : "text-gray-400"
      )}>
        {isExact && <Trophy className="w-4 h-4" />}
        {isTendency && <CheckCircle2 className="w-4 h-4" />}
        {!isExact && !isTendency && points === 0 && <AlertCircle className="w-4 h-4" />}
        <span>{points} pts</span>
      </div>
    )
  }

  // Compact view
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 text-right pr-4">
          <span className="font-semibold text-sm">{match.home_team?.name_es || match.home_team_label}</span>
        </div>
        <div className="flex items-center gap-2 px-2">
          {match.status === 'finished' && match.home_score !== null ? (
            <span className="text-lg font-bold">{match.home_score} - {match.away_score}</span>
          ) : hasPrediction ? (
            <span className="text-sm text-blue-600">{prediction?.home_score} - {prediction?.away_score}</span>
          ) : (
            <span className="text-xs text-gray-400">vs</span>
          )}
        </div>
        <div className="flex-1 pl-4">
          <span className="font-semibold text-sm">{match.away_team?.name_es || match.away_team_label}</span>
        </div>
        <div className="ml-4 text-xs text-gray-500">
          {format(new Date(match.match_date), 'dd/MM HH:mm', { locale: es })}
        </div>
      </div>
    )
  }

  // Full view
  return (
    <Card className={cn(
      "transition-all duration-200",
      isLocked && "opacity-90 bg-gray-50"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {match.group_name ? `Grupo ${match.group_name}` : match.phase}
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {getPointsDisplay()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Form for Form Actions */}
        {isUsingFormActions && userId && (
          <form ref={formRef} action={formAction} className="hidden">
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="homeScore" value={homeScore} />
            <input type="hidden" name="awayScore" value={awayScore} />
          </form>
        )}

        {/* Teams and Scores */}
        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-end text-right">
            <span className="font-bold text-lg">{match.home_team?.name_es || match.home_team_label}</span>
            <span className="text-xs text-gray-500 uppercase">{match.home_team?.code || 'TBD'}</span>
          </div>

          {/* Score Section */}
          <div className="flex items-center gap-2">
            {match.status === 'finished' && match.home_score !== null ? (
              // Real result
              <div className="flex items-center gap-2 text-2xl font-bold">
                <span>{match.home_score}</span>
                <span className="text-gray-400">-</span>
                <span>{match.away_score}</span>
              </div>
            ) : isLocked ? (
              // Locked - show prediction if exists
              hasPrediction ? (
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border border-gray-300 font-bold text-lg">
                    {prediction?.home_score}
                  </div>
                  <span className="text-gray-400 font-bold">-</span>
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border border-gray-300 font-bold text-lg">
                    {prediction?.away_score}
                  </div>
                  <Lock className="w-4 h-4 text-gray-400 ml-2" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Lock className="w-5 h-5" />
                  <span className="text-sm">Sin predicción</span>
                </div>
              )
            ) : (
              // Open for predictions
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={homeScore}
                  onChange={(e) => handleHomeScoreChange(e.target.value)}
                  className="w-14 h-12 text-center text-lg font-bold"
                  placeholder="-"
                  disabled={isLocked || submissionState}
                />
                <span className="text-gray-400 font-bold text-lg">-</span>
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={awayScore}
                  onChange={(e) => handleAwayScoreChange(e.target.value)}
                  className="w-14 h-12 text-center text-lg font-bold"
                  placeholder="-"
                  disabled={isLocked || submissionState}
                />
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-start text-left">
            <span className="font-bold text-lg">{match.away_team?.name_es || match.away_team_label}</span>
            <span className="text-xs text-gray-500 uppercase">{match.away_team?.code || 'TBD'}</span>
          </div>
        </div>

        {/* Date and Stadium */}
        <div className="text-center text-sm text-gray-500 border-t pt-3">
          <div>{format(new Date(match.match_date), "EEEE d 'de' MMMM, HH:mm 'hrs'", { locale: es })}</div>
          <div className="text-xs text-gray-400">{match.stadium}</div>
        </div>

        {/* Save Button (only if open and has changes) */}
        {!isLocked && userId && (
          <div className="flex justify-center">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || submissionState || !homeScore || !awayScore}
              size="sm"
              className={cn(
                hasPrediction && hasChanges && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {submissionState ? 'Guardando...' : hasPrediction ? 'Actualizar' : 'Guardar Predicción'}
            </Button>
          </div>
        )}

        {/* Locked Message */}
        {isLocked && !hasPrediction && (
          <div className="text-center text-sm text-gray-400 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Predicción bloqueada - el partido ya comenzó</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default MatchCard
