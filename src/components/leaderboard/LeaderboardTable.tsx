import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, TrendingUp, User } from 'lucide-react'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function LeaderboardTable() {
  const { leaderboard, isLoading, error } = useLeaderboard()
  const { user } = useAuth()

  const userPosition = useMemo(() => {
    if (!user || !leaderboard) return null
    return leaderboard.find(entry => entry.user_id === user.id)
  }, [leaderboard, user])

  const topThree = useMemo(() => {
    return leaderboard?.slice(0, 3) || []
  }, [leaderboard])

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-pulse text-gray-500">Cargando tabla de posiciones...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        Error al cargar: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Podio - Top 3 */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {topThree.map((entry, index) => {
            const isFirst = index === 0
            const isSecond = index === 1
            const isThird = index === 2
            
            return (
              <Card 
                key={entry.user_id}
                className={cn(
                  "text-center transform transition-all",
                  isFirst && "scale-110 bg-yellow-50 border-yellow-300 z-10",
                  isSecond && "bg-gray-50 border-gray-300",
                  isThird && "bg-orange-50 border-orange-300",
                  user?.id === entry.user_id && "ring-2 ring-blue-500"
                )}
              >
                <CardContent className="pt-6">
                  <div className="mb-2">
                    {isFirst && <Trophy className="w-8 h-8 text-yellow-500 mx-auto" />}
                    {isSecond && <Medal className="w-8 h-8 text-gray-400 mx-auto" />}
                    {isThird && <Award className="w-8 h-8 text-orange-500 mx-auto" />}
                  </div>
                  <div className="text-2xl font-bold mb-1">#{entry.rank}</div>
                  <div className="font-semibold truncate">{entry.username}</div>
                  <div className="text-3xl font-bold text-blue-600 mt-2">
                    {entry.total_points}
                    <span className="text-sm text-gray-500 ml-1">pts</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {entry.exact_predictions} exactos • {entry.correct_tendencies} tendencias
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Tabla completa */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Clasificación Completa
              </CardTitle>
              <CardDescription>
                {leaderboard?.length || 0} participantes
              </CardDescription>
            </div>
            {userPosition && (
              <div className="text-right">
                <div className="text-sm text-gray-500">Tu posición</div>
                <Badge className="text-lg">
                  #{userPosition.rank} • {userPosition.total_points} pts
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Pos</th>
                  <th className="text-left py-3 px-2">Usuario</th>
                  <th className="text-center py-3 px-2">Pts</th>
                  <th className="text-center py-3 px-2 hidden sm:table-cell">Exactos</th>
                  <th className="text-center py-3 px-2 hidden sm:table-cell">Tendencias</th>
                  <th className="text-center py-3 px-2 hidden md:table-cell">Total Pred.</th>
                  <th className="text-right py-3 px-2 hidden lg:table-cell">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard?.map((entry) => {
                  const isCurrentUser = user?.id === entry.user_id
                  
                  return (
                    <tr 
                      key={entry.user_id}
                      className={cn(
                        "border-b last:border-0 hover:bg-gray-50",
                        isCurrentUser && "bg-blue-50"
                      )}
                    >
                      <td className="py-3 px-2">
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-full font-bold",
                          entry.rank === 1 && "bg-yellow-100 text-yellow-700",
                          entry.rank === 2 && "bg-gray-100 text-gray-700",
                          entry.rank === 3 && "bg-orange-100 text-orange-700",
                          entry.rank > 3 && "text-gray-600"
                        )}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className={cn(
                            "font-medium",
                            isCurrentUser && "text-blue-600"
                          )}>
                            {entry.username}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">Tú</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="font-bold text-lg text-blue-600">
                          {entry.total_points}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center hidden sm:table-cell">
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {entry.exact_predictions}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center hidden sm:table-cell">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                          {entry.correct_tendencies}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center hidden md:table-cell text-gray-600">
                        {entry.total_predictions}
                      </td>
                      <td className="py-3 px-2 text-right hidden lg:table-cell text-sm text-gray-400">
                        {format(new Date(entry.last_updated), 'dd/MM HH:mm', { locale: es })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LeaderboardTable
