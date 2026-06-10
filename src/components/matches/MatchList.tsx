import { useState, useMemo, useEffect } from 'react'
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card' // Reservado para filtros
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select' // Reservado para filtros
import { MatchCard } from './MatchCard'
import { useMatches } from '@/hooks/useMatches'
import { usePredictions } from '@/hooks/usePredictions'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function MatchList() {
  const { user } = useAuth()
  const { matches, teams: _teams, isLoading, error, getMatchesByPhase } = useMatches()
  const { predictions, savePrediction, isSaving } = usePredictions(user?.id)
  
  const [filter, _setFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all')
  const [groupFilter, _setGroupFilter] = useState<string>('all')
  const [currentDateIndex, setCurrentDateIndex] = useState(0)

  // Reset to first date when filters change
  useEffect(() => {
    setCurrentDateIndex(0)
  }, [filter, groupFilter])

  /*
  // Get unique groups (reservado para filtros futuros)
  const _groups = useMemo(() => {
    const groupSet = new Set(teams?.map(t => t.group_name) || [])
    return Array.from(groupSet).sort()
  }, [teams])
  */

  // Filter matches
  const filteredMatches = useMemo(() => {
    if (!matches) return []
    
    let result = [...matches]
    
    // Status filter
    switch (filter) {
      case 'upcoming':
        result = result.filter(m => m.status === 'pending' && new Date(m.match_date) > new Date())
        break
      case 'live':
        result = result.filter(m => m.status === 'live')
        break
      case 'finished':
        result = result.filter(m => m.status === 'finished')
        break
    }
    
    // Group filter
    if (groupFilter !== 'all') {
      result = result.filter(m => m.group_name === groupFilter)
    }
    
    return result
  }, [matches, filter, groupFilter])

  // Group by date
  const matchesByDate = useMemo(() => {
    const grouped: { [key: string]: typeof filteredMatches } = {}
    filteredMatches.forEach(match => {
      const date = format(new Date(match.match_date), 'yyyy-MM-dd')
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(match)
    })
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredMatches])

  const handleSavePrediction = (matchId: string, homeScore: number, awayScore: number) => {
    savePrediction.mutate({ matchId, homeScore, awayScore })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Cargando partidos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error al cargar los partidos: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters - DESACTIVADOS TEMPORALMENTE
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Estado</label>
              <Select value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los partidos</SelectItem>
                  <SelectItem value="upcoming">Próximos</SelectItem>
                  <SelectItem value="live">En vivo</SelectItem>
                  <SelectItem value="finished">Finalizados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Grupo</label>
              <Select value={groupFilter} onValueChange={(v) => v && setGroupFilter(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos</SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group} value={group}>Grupo {group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Mostrando {filteredMatches.length} de {matches?.length} partidos
          </div>
        </CardContent>
      </Card>
      */}

      {/* Matches by Phase */}
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
                    {format(new Date(matchesByDate[currentDateIndex][0]), "EEEE d 'de' MMMM", { locale: es })}
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

              {/* Matches Grid - Only Current Date */}
              <div className="grid gap-4 md:grid-cols-2">
                {matchesByDate[currentDateIndex][1].map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions?.find(p => p.match_id === match.id)}
                    onSavePrediction={user ? handleSavePrediction : undefined}
                    isSaving={isSaving}
                    userId={user?.id}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="knockout">
          <div className="grid gap-4 md:grid-cols-2">
            {getMatchesByPhase('round_of_32')?.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions?.find(p => p.match_id === match.id)}
                onSavePrediction={user ? handleSavePrediction : undefined}
                isSaving={isSaving}
                userId={user?.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quarter">
          <div className="grid gap-4 md:grid-cols-2">
            {getMatchesByPhase('quarter')?.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions?.find(p => p.match_id === match.id)}
                onSavePrediction={user ? handleSavePrediction : undefined}
                isSaving={isSaving}
                userId={user?.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="semifinal">
          <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
            {getMatchesByPhase('semi')?.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions?.find(p => p.match_id === match.id)}
                onSavePrediction={user ? handleSavePrediction : undefined}
                isSaving={isSaving}
                userId={user?.id}
              />
            ))}
            {getMatchesByPhase('third_place')?.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions?.find(p => p.match_id === match.id)}
                onSavePrediction={user ? handleSavePrediction : undefined}
                isSaving={isSaving}
                userId={user?.id}
              />
            ))}
            {getMatchesByPhase('final')?.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions?.find(p => p.match_id === match.id)}
                onSavePrediction={user ? handleSavePrediction : undefined}
                isSaving={isSaving}
                userId={user?.id}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default MatchList
