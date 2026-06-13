import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Home from '@/pages/Home'
import Matches from '@/pages/Matches'
import Leaderboard from '@/pages/Leaderboard'
import Profile from '@/pages/Profile'
import Auth from '@/pages/Auth'
import { useAuth } from '@/hooks/useAuth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen" role="status" aria-label="Cargando sesión">
        <div className="animate-pulse text-gray-500">Cargando...</div>
      </div>
    )
  }
  
  return user ? <>{children}</> : <Navigate to="/auth" replace />
}

function App() {
  return (
    <ErrorBoundary boundaryName="App">
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <ErrorBoundary boundaryName="Navigation">
            <Navigation />
          </ErrorBoundary>
          <main className="pb-8">
            <Routes>
              <Route path="/" element={
                <ErrorBoundary boundaryName="Home">
                  <Home />
                </ErrorBoundary>
              } />
              <Route path="/matches" element={
                <ErrorBoundary boundaryName="Matches">
                  <Matches />
                </ErrorBoundary>
              } />
              <Route path="/leaderboard" element={
                <ErrorBoundary boundaryName="Leaderboard">
                  <Leaderboard />
                </ErrorBoundary>
              } />
              <Route path="/auth" element={
                <ErrorBoundary boundaryName="Auth">
                  <Auth />
                </ErrorBoundary>
              } />
              <Route 
                path="/profile" 
                element={
                  <PrivateRoute>
                    <ErrorBoundary boundaryName="Profile">
                      <Profile />
                    </ErrorBoundary>
                  </PrivateRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App