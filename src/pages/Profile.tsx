import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { usePredictions } from '@/hooks/usePredictions'
import { User, Mail, Trophy, Target, BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Profile() {
  const { user, profile, signOut } = useAuth()
  const { getUserStats } = usePredictions(user?.id)
  
  const stats = getUserStats()

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl flex items-center gap-2">
                <User className="w-8 h-8 text-blue-600" />
                Mi Perfil
              </CardTitle>
              <CardDescription>
                Gestiona tu cuenta y ve tus estadísticas
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => signOut()}>
              Cerrar Sesión
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                <User className="w-4 h-4 text-gray-500" />
                <span>{profile?.username || 'Sin username'}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                <Mail className="w-4 h-4 text-gray-500" />
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ID de Usuario</Label>
              <Input value={user?.id || ''} disabled className="font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Mis Estadísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Trophy className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{stats.totalPoints}</div>
                  <div className="text-sm text-gray-600">Puntos Totales</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Target className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-gray-600">Predicciones</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.exact}</div>
                  <div className="text-sm text-gray-600">Exactos (3pts)</div>
                </div>
                
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{stats.tendency}</div>
                  <div className="text-sm text-gray-600">Tendencias (1pt)</div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                <p>Aún no has hecho predicciones</p>
                <Link to="/matches">
                  <Button className="mt-4">Ir a Partidos</Button>
                </Link>
              </div>
            )}
            
            {stats && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg text-center">
                <span className="text-sm text-gray-600">Promedio: </span>
                <Badge variant="secondary" className="ml-2">
                  {stats.average} pts/predicción
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
