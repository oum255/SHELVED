import { createContext, useContext, useEffect, useState } from 'react'
import {
  changeEmail as apiChangeEmail,
  changePassword as apiChangePassword,
  changeUsername as apiChangeUsername,
  deleteAccount as apiDeleteAccount,
  getMe,
  login as apiLogin,
  removeAvatar as apiRemoveAvatar,
  updateProfile as apiUpdateProfile,
  uploadAvatar as apiUploadAvatar,
} from '../api'

const AuthContext = createContext(null)

// Clé localStorage : persiste la connexion même après fermeture de l'onglet.
const TOKEN_KEY = 'shelved_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // vrai tant qu'on vérifie le jeton

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    getMe(token)
      .then((profile) => setUser(profile))
      .catch(() => {
        // jeton invalide ou expiré → on nettoie
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  // Écoute l'événement émis par api.js sur un jeton expiré/invalide :
  // déconnexion propre → ProtectedRoute redirige vers /login.
  useEffect(() => {
    function handleUnauthorized() {
      sessionStorage.setItem('shelved_session_expired', '1')
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    }
    window.addEventListener('shelved:unauthorized', handleUnauthorized)
    return () =>
      window.removeEventListener('shelved:unauthorized', handleUnauthorized)
  }, [])

  async function signIn(email, password) {
    const data = await apiLogin({ email, password })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token) // déclenche le useEffect ci-dessus → récupère le profil
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  // RGPD : supprime le compte côté serveur, puis déconnecte localement.
  async function deleteAccount() {
    await apiDeleteAccount(token)
    signOut()
  }

  async function updateProfile(changes) {
    const updated = await apiUpdateProfile(token, changes)
    setUser(updated)
    return updated
  }

  async function changeUsername(newUsername, currentPassword) {
    const updated = await apiChangeUsername(token, newUsername, currentPassword)
    setUser(updated)
    return updated
  }

  async function changeEmail(newEmail, currentPassword) {
    const updated = await apiChangeEmail(token, newEmail, currentPassword)
    setUser(updated)
    return updated
  }

  // Contrairement aux fonctions ci-dessus, ne renvoie pas de profil à jour :
  // le mot de passe n'en fait jamais partie.
  async function changePassword(currentPassword, newPassword) {
    return apiChangePassword(token, currentPassword, newPassword)
  }

  async function uploadAvatar(file) {
    const updated = await apiUploadAvatar(token, file)
    setUser(updated)
    return updated
  }

  async function removeAvatar() {
    const updated = await apiRemoveAvatar(token)
    setUser(updated)
    return updated
  }

  const value = {
    token,
    user,
    loading,
    signIn,
    signOut,
    deleteAccount,
    updateProfile,
    changeUsername,
    changeEmail,
    changePassword,
    uploadAvatar,
    removeAvatar,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
