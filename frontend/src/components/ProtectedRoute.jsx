import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Garde-barrière pour une page réservée aux connectés : rien pendant la
// vérification du jeton (évite un clignotement), sinon redirige ou affiche la page.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default ProtectedRoute
