import { useState, useCallback, useMemo, memo, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Trophy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { shouldDisablePredictionInputs, validatePredictionScores } from '@/utils/matchValidation';
import { isFeatureEnabled } from '@/config/feature-flags';
import type { Match } from '@/types';
import type { Prediction } from '@/types';

interface VirtualMatchCardProps {
  match: Match;
  prediction?: Prediction;
  onSavePrediction?: (matchId: string, homeScore: number, awayScore: number) => void;
  userId?: string;
  compact?: boolean;
  style?: React.CSSProperties; // Required for virtualization
  formAction?: (formData: FormData) => void;
  isFormActionPending?: boolean;
}

export const VirtualMatchCard = memo(function VirtualMatchCard({ 
  match, 
  prediction, 
  onSavePrediction, 
  userId,
  compact = false,
  style,
  formAction,
  isFormActionPending = false
}: VirtualMatchCardProps) {
  const [homeScore, setHomeScore] = useState<string>(prediction?.home_score?.toString() || '');
  const [awayScore, setAwayScore] = useState<string>(prediction?.away_score?.toString() || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  const isFormActionsEnabled = isFeatureEnabled('react-19-form-actions');
  const isUsingFormActions = isFormActionsEnabled && !!formAction;

  // Check if match is locked (centralized validation)
  const isLocked = useMemo(() => {
    return shouldDisablePredictionInputs(match);
  }, [match.status, match.is_locked, match.match_date]);

  // Check if prediction exists
  const hasPrediction = !!prediction && prediction.home_score !== undefined;

  // Handle score changes
  const handleHomeScoreChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10);
    if (value === '' || (numValue >= 0 && numValue <= 99)) {
      setHomeScore(value);
      setHasChanges(true);
    }
  }, []);

  const handleAwayScoreChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10);
    if (value === '' || (numValue >= 0 && numValue <= 99)) {
      setAwayScore(value);
      setHasChanges(true);
    }
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!userId || isLocked) return;
    
    const home = parseInt(homeScore, 10);
    const away = parseInt(awayScore, 10);
    
    const scoreCheck = validatePredictionScores(home, away);
    if (!scoreCheck.valid) return;

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
    if (!onSavePrediction) return;
    
    setIsSubmitting(true);
    try {
      await onSavePrediction(match.id, home, away);
      setHasChanges(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSavePrediction, match.id, homeScore, awayScore, userId, isLocked, isUsingFormActions, formAction]);

  // Get status badge
  const getStatusBadge = () => {
    switch (match.status) {
      case 'live':
        return <Badge variant="destructive" className="animate-pulse">EN VIVO</Badge>;
      case 'finished':
        return <Badge variant="secondary">FINALIZADO</Badge>;
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
        );
    }
  };

  // Combined submission state
  const submissionState = isUsingFormActions ? isFormActionPending : isSubmitting

  // Get points badge if prediction exists
  const getPointsBadge = () => {
    if (!hasPrediction || !prediction?.points_earned) return null;
    
    return (
      <Badge variant={prediction.points_earned === 3 ? 'default' : 'outline'} className="ml-2">
        {prediction.points_earned === 3 ? (
          <>
            <Trophy className="w-3 h-3 mr-1" />
            3 PTS
          </>
        ) : prediction.points_earned === 1 ? (
          <>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            1 PT
          </>
        ) : (
          <>
            <AlertCircle className="w-3 h-3 mr-1" />
            0 PTS
          </>
        )}
      </Badge>
    );
  };

  // Get team display name
  const getTeamName = (team: Match['home_team']) => {
    if (team?.name_es) return team.name_es;
    if (match.home_team_label) return match.home_team_label;
    return 'TBD';
  };

  const formattedDate = format(new Date(match.match_date), "HH:mm", { locale: es });

  return (
    <div style={style} className={compact ? 'p-2' : ''}>
      <Card className={cn(
        "h-full transition-all duration-200 hover:shadow-md",
        compact && "shadow-sm"
      )}>
        <CardHeader className={cn(
          "pb-3",
          compact && "p-4 pb-2"
        )}>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              {getStatusBadge()}
              {getPointsBadge()}
            </div>
            <div className="text-sm text-gray-500">
              {formattedDate}
              {match.stadium && !compact && (
                <span className="ml-2">• {match.stadium}</span>
              )}
            </div>
          </div>
          
          {!compact && (
            <div className="mt-2 text-sm text-gray-500">
              {format(new Date(match.match_date), "EEEE d 'de' MMMM", { locale: es })}
              {match.stadium && <span className="ml-2">• {match.stadium}</span>}
            </div>
          )}
        </CardHeader>

        <CardContent className={cn(
          "pt-0",
          compact && "p-4 pt-0"
        )}>
          {/* Form for Form Actions */}
          {isUsingFormActions && userId && (
            <form ref={formRef} action={formAction} className="hidden">
              <input type="hidden" name="matchId" value={match.id} />
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="homeScore" value={homeScore} />
              <input type="hidden" name="awayScore" value={awayScore} />
            </form>
          )}

          {/* Teams and scores */}
          <div className="grid grid-cols-12 gap-4 items-center mb-4">
            {/* Home team */}
            <div className="col-span-5 text-right">
              <div className="font-semibold text-gray-800">
                {getTeamName(match.home_team)}
              </div>
              {match.home_team?.code && (
                <div className="text-sm text-gray-500">({match.home_team.code})</div>
              )}
              {match.home_team?.flag_url && (
                <img 
                  src={match.home_team.flag_url} 
                  alt={`Bandera de ${getTeamName(match.home_team)}`}
                  className="w-8 h-6 mx-auto mt-1 object-cover rounded"
                />
              )}
            </div>

            {/* VS / Score */}
            <div className="col-span-2 text-center">
              {match.status === 'finished' ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {match.home_score ?? '-'} - {match.away_score ?? '-'}
                  </div>
                  <div className="text-xs text-gray-500">RESULTADO</div>
                </div>
              ) : (
                <div className="text-gray-400 font-semibold">VS</div>
              )}
            </div>

            {/* Away team */}
            <div className="col-span-5 text-left">
              <div className="font-semibold text-gray-800">
                {getTeamName(match.away_team)}
              </div>
              {match.away_team?.code && (
                <div className="text-sm text-gray-500">({match.away_team.code})</div>
              )}
              {match.away_team?.flag_url && (
                <img 
                  src={match.away_team.flag_url} 
                  alt={`Bandera de ${getTeamName(match.away_team)}`}
                  className="w-8 h-6 mx-auto mt-1 object-cover rounded"
                />
              )}
            </div>
          </div>

          {/* Prediction inputs */}
          {match.status === 'pending' && userId && (
            <div className={cn(
              "space-y-4",
              compact && "space-y-2"
            )}>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-right">
<Input
                     type="number"
                     min="0"
                     max="99"
                     value={homeScore}
                     onChange={(e) => handleHomeScoreChange(e.target.value)}
                     disabled={isLocked || submissionState}
                     className={cn(
                       "text-center",
                       isLocked && "opacity-50 cursor-not-allowed"
                     )}
                     placeholder="0"
                   />
                </div>
                
                <div className="col-span-2 text-center text-gray-400">-</div>
                
                <div className="col-span-5 text-left">
<Input
                     type="number"
                     min="0"
                     max="99"
                     value={awayScore}
                     onChange={(e) => handleAwayScoreChange(e.target.value)}
                     disabled={isLocked || submissionState}
                     className={cn(
                       "text-center",
                       isLocked && "opacity-50 cursor-not-allowed"
                     )}
                     placeholder="0"
                   />
                </div>
              </div>

              {!isLocked && (
<Button
                   onClick={handleSave}
                   disabled={!hasChanges || submissionState}
                   className="w-full"
                   size={compact ? "sm" : "default"}
                 >
                   {submissionState ? (
                     <>
                       <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                       GUARDANDO...
                     </>
                   ) : hasPrediction ? (
                     hasChanges ? 'ACTUALIZAR' : 'PREDICCIÓN GUARDADA'
                   ) : (
                     'GUARDAR PREDICCIÓN'
                   )}
                 </Button>
              )}

              {isLocked && (
                <div className="text-center text-sm text-gray-500 py-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Predicciones bloqueadas para este partido
                </div>
              )}
            </div>
          )}

          {/* Phase/group info */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Partido #{match.match_number}</span>
              <span className="font-medium">
                {match.phase === 'group' ? `Grupo ${match.group_name}` : (
                  match.phase === 'round_of_32' ? 'Octavos' :
                  match.phase === 'round_of_16' ? 'Dieciseisavos' :
                  match.phase === 'quarter' ? 'Cuartos' :
                  match.phase === 'semi' ? 'Semifinal' :
                  match.phase === 'third_place' ? 'Tercer lugar' : 'Final'
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});