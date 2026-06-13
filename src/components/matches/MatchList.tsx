import { useState, useMemo, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchCard } from './MatchCard';
import { VirtualMatchList, GroupedVirtualMatchList } from './virtualization/VirtualMatchList';
import { VirtualizationProvider, useVirtualization } from './virtualization/VirtualizationProvider';
import { useMatches } from '@/hooks/useMatches';
import { usePredictions } from '@/hooks/usePredictions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Inner component that uses virtualization context
function MatchListContent() {
  const { user } = useAuth();
  const { matches, teams: _teams, isLoading, error, getMatchesByPhase } = useMatches();
  const { predictions, savePrediction } = usePredictions(user?.id);
  const { isEnabled: isVirtualizationEnabled } = useVirtualization();
  
  const [filter, _setFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all');
  const [groupFilter, _setGroupFilter] = useState<string>('all');
  const [currentDateIndex, setCurrentDateIndex] = useState(0);

  // Reset to first date when filters change
  useEffect(() => {
    setCurrentDateIndex(0);
  }, [filter, groupFilter]);

  /*
  // Get unique groups (reservado para filtros futuros)
  const _groups = useMemo(() => {
    const groupSet = new Set(teams?.map(t => t.group_name) || []);
    return Array.from(groupSet).sort();
  }, [teams]);
  */

  // Filter matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    
    let result = [...matches];
    
    // Status filter
    switch (filter) {
      case 'upcoming':
        result = result.filter(m => m.status === 'pending' && new Date(m.match_date) > new Date());
        break;
      case 'live':
        result = result.filter(m => m.status === 'live');
        break;
      case 'finished':
        result = result.filter(m => m.status === 'finished');
        break;
    }
    
    // Group filter
    if (groupFilter !== 'all') {
      result = result.filter(m => m.group_name === groupFilter);
    }
    
    return result;
  }, [matches, filter, groupFilter]);

  // Group by date
  const matchesByDate = useMemo(() => {
    const grouped: { [key: string]: typeof filteredMatches } = {};
    filteredMatches.forEach(match => {
      const date = format(new Date(match.match_date), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(match);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMatches]);

  const handleSavePrediction = useCallback((matchId: string, homeScore: number, awayScore: number) => {
    savePrediction.mutate({ matchId, homeScore, awayScore });
  }, [savePrediction]);

  // Check if virtualization should be used for current date
  const shouldUseVirtualizationForCurrentDate = useMemo(() => {
    if (!isVirtualizationEnabled) return false;
    const matchCount = matchesByDate[currentDateIndex]?.[1]?.length || 0;
    return matchCount > 10; // Use virtualization for more than 10 matches
  }, [isVirtualizationEnabled, matchesByDate, currentDateIndex]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Cargando partidos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error al cargar los partidos: {error.message}</p>
      </div>
    );
  }

  // Prepare groups for grouped virtualization
  const knockoutGroups = useMemo(() => [
    {
      id: 'round_of_32',
      title: 'Octavos de Final',
      matches: getMatchesByPhase('round_of_32') || [],
    },
    {
      id: 'round_of_16',
      title: 'Dieciseisavos de Final',
      matches: getMatchesByPhase('round_of_16') || [],
    },
  ], [getMatchesByPhase]);

  const quarterGroups = useMemo(() => [
    {
      id: 'quarter',
      title: 'Cuartos de Final',
      matches: getMatchesByPhase('quarter') || [],
    },
  ], [getMatchesByPhase]);

  const semifinalGroups = useMemo(() => [
    {
      id: 'semi',
      title: 'Semifinales',
      matches: getMatchesByPhase('semi') || [],
    },
    {
      id: 'third_place',
      title: 'Tercer Lugar',
      matches: getMatchesByPhase('third_place') || [],
    },
    {
      id: 'final',
      title: 'Final',
      matches: getMatchesByPhase('final') || [],
    },
  ], [getMatchesByPhase]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="group">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="group">Fase de Grupos</TabsTrigger>
          <TabsTrigger value="knockout">Eliminatoria</TabsTrigger>
          <TabsTrigger value="quarter">Cuartos</TabsTrigger>
          <TabsTrigger value="semifinal">Semis/Final</TabsTrigger>
        </TabsList>

        <TabsContent value="group" className="space-y-6">
          {matchesByDate.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No hay partidos que coincidan con los filtros
            </div>
          ) : (
            <div>
              {/* Date Navigation */}
              <div className="flex items-center justify-between mb-6 p-4 bg-white rounded-lg border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDateIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentDateIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {format(new Date(matchesByDate[currentDateIndex]![0]), "EEEE d 'de' MMMM", { locale: es })}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Día {currentDateIndex + 1} de {matchesByDate.length}
                  </p>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDateIndex(prev => Math.min(matchesByDate.length - 1, prev + 1))}
                  disabled={currentDateIndex === matchesByDate.length - 1}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Matches Grid - Virtualized or Regular */}
              {shouldUseVirtualizationForCurrentDate ? (
                <VirtualMatchList
                  matches={matchesByDate[currentDateIndex]![1]}
                  predictions={predictions}
                  onSavePrediction={user ? handleSavePrediction : undefined}
                  userId={user?.id}
                  containerHeight={600}
                  overscan={5}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {matchesByDate[currentDateIndex]![1].map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      prediction={predictions?.find(p => p.match_id === match.id)}
                      onSavePrediction={user ? handleSavePrediction : undefined}
                      userId={user?.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="knockout" className="space-y-6">
          {isVirtualizationEnabled ? (
            <GroupedVirtualMatchList
              groups={knockoutGroups.filter(group => group.matches.length > 0)}
              predictions={predictions}
              onSavePrediction={user ? handleSavePrediction : undefined}
              userId={user?.id}
              containerHeight={600}
            />
          ) : (
            <div className="space-y-8">
              {knockoutGroups
                .filter(group => group.matches.length > 0)
                .map(group => (
                  <div key={group.id} className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                      {group.title} ({group.matches.length} partidos)
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {group.matches.map(match => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          prediction={predictions?.find(p => p.match_id === match.id)}
                          onSavePrediction={user ? handleSavePrediction : undefined}
                          userId={user?.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quarter" className="space-y-6">
          {isVirtualizationEnabled ? (
            <GroupedVirtualMatchList
              groups={quarterGroups.filter(group => group.matches.length > 0)}
              predictions={predictions}
              onSavePrediction={user ? handleSavePrediction : undefined}
              userId={user?.id}
              containerHeight={400}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {quarterGroups.flatMap(group => group.matches).map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  prediction={predictions?.find(p => p.match_id === match.id)}
                  onSavePrediction={user ? handleSavePrediction : undefined}
                  userId={user?.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="semifinal" className="space-y-6">
          {isVirtualizationEnabled ? (
            <GroupedVirtualMatchList
              groups={semifinalGroups.filter(group => group.matches.length > 0)}
              predictions={predictions}
              onSavePrediction={user ? handleSavePrediction : undefined}
              userId={user?.id}
              containerHeight={500}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
              {semifinalGroups.flatMap(group => group.matches).map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  prediction={predictions?.find(p => p.match_id === match.id)}
                  onSavePrediction={user ? handleSavePrediction : undefined}
                  userId={user?.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Main component that provides virtualization context
export function MatchList() {
  return (
    <VirtualizationProvider>
      <MatchListContent />
    </VirtualizationProvider>
  );
}

export default MatchList;