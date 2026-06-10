import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import Home from '@/pages/Home'
import Matches from '@/pages/Matches'
import Leaderboard from '@/pages/Leaderboard'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'
import { useAuth } from '@/hooks/useAuth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>
  }
  
  return user ? <>{children}</> : <Navigate to="/auth" replace />
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="pb-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/profile" 
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
