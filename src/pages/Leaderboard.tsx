import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'

export default function Leaderboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-3xl">Tabla de Posiciones</CardTitle>
          <CardDescription>
            Sistema de puntuación: 3 pts exacto, 1 pt tendencia, 0 incorrecto
          </CardDescription>
        </CardHeader>
      </Card>
      <LeaderboardTable />
    </div>
  )
}
