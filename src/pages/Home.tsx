import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMatches } from '@/hooks/useMatches'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Home() {
  const { matches, teams, isLoading, error } = useMatches()

  const upcomingMatches = matches?.filter(m => new Date(m.match_date) > new Date()).slice(0, 5)
  const totalTeams = teams?.length ?? 0
  const totalMatches = matches?.length ?? 0

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Cargando datos de Supabase...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-red-500 text-center">
              Error de conexión: {error.message}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Quiniela Mundial 2026</CardTitle>
          <CardDescription>
            Conexión exitosa con Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <Badge variant="secondary" className="text-lg">
                {totalTeams} Equipos
              </Badge>
            </div>
            <div className="text-center">
              <Badge variant="secondary" className="text-lg">
                {totalMatches} Partidos
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Próximos Partidos</CardTitle>
          <CardDescription>Top 5 partidos más cercanos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingMatches?.map(match => (
              <div key={match.id} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                <div className="flex-1 text-right font-semibold">
                  {match.home_team?.name_es || match.home_team_label}
                </div>
                <div className="mx-4 text-gray-500">vs</div>
                <div className="flex-1 font-semibold">
                  {match.away_team?.name_es || match.away_team_label}
                </div>
                <div className="ml-4 text-sm text-gray-500">
                  {format(new Date(match.match_date), 'dd MMM HH:mm', { locale: es })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
