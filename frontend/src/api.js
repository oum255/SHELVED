// Centralise les appels au backend SHELVED (adresse à un seul endroit).

const API_URL = 'http://localhost:8000'

// En cas d'erreur backend, relance une Error avec son "detail" (ex: "email_already_used")
// pour pouvoir afficher le bon message traduit.
async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    // fetch a échoué au niveau réseau = serveur injoignable (souvent : backend pas lancé).
    throw new Error('network')
  }

  if (!response.ok) {
    let detail = 'unknown_error'
    try {
      const data = await response.json()
      // FastAPI renvoie soit { detail: "texte" }, soit { detail: [ ... ] }.
      detail = typeof data.detail === 'string' ? data.detail : 'validation_error'
    } catch {
      // pas de corps JSON
    }
    // Jeton expiré/invalide : prévient l'app de façon centralisée plutôt que par page.
    if (
      response.status === 401 &&
      (detail === 'token_expired' || detail === 'invalid_token')
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('shelved:unauthorized'))
      }
    }
    throw new Error(detail)
  }

  // 204 = succès sans contenu (ex: suppression) → rien à lire.
  if (response.status === 204) return null
  return response.json()
}

export async function checkHealth() {
  return request('/api/health')
}

// Crée un compte. `data` = { email, username, password, language }.
export async function signup(data) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Connexion. `data` = { email, password }. Renvoie { access_token, token_type }.
export async function login(data) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Compte connecté mais pas encore vérifié.
export async function resendVerification(token) {
  return request('/api/auth/resend-verification', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function verifyEmail(verifyToken) {
  return request(`/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`)
}

export async function forgotPassword(email) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(resetToken, newPassword) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: resetToken, new_password: newPassword }),
  })
}

export async function getMe(token) {
  return request('/api/auth/me', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}

// `changes` : bio, objectif de lecture annuel.
export async function updateProfile(token, changes) {
  return request('/api/auth/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(changes),
  })
}

// Change mon pseudo (protégé par le mot de passe actuel, 1 fois / 30 jours).
export async function changeUsername(token, newUsername, currentPassword) {
  return request('/api/auth/change-username', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ new_username: newUsername, current_password: currentPassword }),
  })
}

export async function changeEmail(token, newEmail, currentPassword) {
  return request('/api/auth/change-email', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
  })
}

export async function changePassword(token, currentPassword, newPassword) {
  return request('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
}

// FormData (multipart) : pas de Content-Type manuel, le navigateur pose la bonne "frontière".
export async function uploadAvatar(token, file) {
  const form = new FormData()
  form.append('file', file)

  let response
  try {
    response = await fetch(`${API_URL}/api/auth/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
  } catch {
    throw new Error('network')
  }
  if (!response.ok) {
    let detail = 'unknown_error'
    try {
      const data = await response.json()
      detail = typeof data.detail === 'string' ? data.detail : 'validation_error'
    } catch {
      // pas de corps JSON
    }
    throw new Error(detail)
  }
  return response.json()
}

// Retire ma photo de profil (retour aux initiales).
export async function removeAvatar(token) {
  return request('/api/auth/me/avatar', {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// RGPD : supprime définitivement le compte et toutes ses données.
export async function deleteAccount(token) {
  return request('/api/auth/me', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

// --- Bibliothèque ---

// Public : pas de jeton.
export async function searchBooks(query) {
  const q = encodeURIComponent(query)
  return request(`/api/books/search?q=${q}`)
}

// `status` optionnel : "to_read" / "reading" / "read".
export async function getLibrary(token, status) {
  const query = status ? `?status=${status}` : ''
  return request(`/api/books/library${query}`, { headers: authHeaders(token) })
}

export async function addToLibrary(token, book, status = 'to_read') {
  return request('/api/books/library', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ book, status }),
  })
}

export async function reorderLibrary(token, orderedIds) {
  return request('/api/books/reorder', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ ordered_ids: orderedIds }),
  })
}

export async function removeFromLibrary(token, userBookId) {
  return request(`/api/books/library/${userBookId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// --- Détail d'un livre ---

export async function getLibraryBook(token, userBookId) {
  return request(`/api/books/library/${userBookId}`, {
    headers: authHeaders(token),
  })
}

// `changes` = { status?, rating?, current_page? }.
export async function updateLibraryBook(token, userBookId, changes) {
  return request(`/api/books/library/${userBookId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(changes),
  })
}

export async function getNotes(token, userBookId) {
  return request(`/api/books/library/${userBookId}/notes`, {
    headers: authHeaders(token),
  })
}

export async function addNote(token, userBookId, content, pageNumber = null) {
  return request(`/api/books/library/${userBookId}/notes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content, page_number: pageNumber }),
  })
}

export async function deleteNote(token, noteId) {
  return request(`/api/books/notes/${noteId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// --- Sessions de lecture ---

// `session` = { pages_read, mood?, duration_minutes?, session_date?, notes? }.
export async function logSession(token, userBookId, session) {
  return request(`/api/books/library/${userBookId}/sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(session),
  })
}

export async function getSessions(token, userBookId) {
  return request(`/api/books/library/${userBookId}/sessions`, {
    headers: authHeaders(token),
  })
}

// --- Statistiques ---

export async function getStats(token) {
  return request('/api/stats', { headers: authHeaders(token) })
}

export async function getMoodSessions(token, mood) {
  return request(`/api/stats/mood-sessions?mood=${encodeURIComponent(mood)}`, {
    headers: authHeaders(token),
  })
}

export async function getDaySessions(token, isoDate) {
  return request(`/api/stats/day-sessions?day=${encodeURIComponent(isoDate)}`, {
    headers: authHeaders(token),
  })
}

// --- IA : recommandations + chat ---

export async function getRecommendations(token) {
  return request('/api/ai/recommendations', { headers: authHeaders(token) })
}

export async function refreshRecommendations(token) {
  return request('/api/ai/recommendations/refresh', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function suggestBooks(token, query) {
  return request('/api/ai/suggest', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ query }),
  })
}

// --- Images des livres ---

// Publiques + les miennes.
export async function getBookImages(token, userBookId) {
  return request(`/api/books/library/${userBookId}/images`, {
    headers: authHeaders(token),
  })
}

// FormData (multipart) : pas de Content-Type manuel, le navigateur s'en charge.
export async function uploadBookImage(token, userBookId, file) {
  const form = new FormData()
  form.append('file', file)

  let response
  try {
    response = await fetch(
      `${API_URL}/api/books/library/${userBookId}/images`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    )
  } catch {
    throw new Error('network')
  }
  if (!response.ok) {
    let detail = 'unknown_error'
    try {
      const data = await response.json()
      detail = typeof data.detail === 'string' ? data.detail : 'validation_error'
    } catch {
      // pas de corps JSON
    }
    throw new Error(detail)
  }
  return response.json()
}

export async function deleteBookImage(token, imageId) {
  return request(`/api/books/images/${imageId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// --- Profils publics & abonnements ---

// Public.
export async function searchUsers(query) {
  return request(`/api/users?q=${encodeURIComponent(query)}`)
}

// `token` optionnel : s'il est fourni, la réponse indique aussi si on suit déjà cette personne / si c'est nous.
export async function getProfile(username, token) {
  return request(`/api/users/${encodeURIComponent(username)}`, {
    headers: token ? authHeaders(token) : undefined,
  })
}

export async function followUser(token, username) {
  return request(`/api/users/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function unfollowUser(token, username) {
  return request(`/api/users/${encodeURIComponent(username)}/follow`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export async function getFollowers(username) {
  return request(`/api/users/${encodeURIComponent(username)}/followers`)
}

export async function getFollowing(username) {
  return request(`/api/users/${encodeURIComponent(username)}/following`)
}

// `username` doit être mon propre pseudo (uniquement sur ma propre liste d'abonnés).
export async function removeFollower(token, username, followerUsername) {
  return request(
    `/api/users/${encodeURIComponent(username)}/followers/${encodeURIComponent(followerUsername)}`,
    { method: 'DELETE', headers: authHeaders(token) }
  )
}

// Public, ex: la liste "Lus" d'un utilisateur.
export async function getUserBooks(username, statusFilter, limit) {
  const params = new URLSearchParams()
  if (statusFilter) params.set('status', statusFilter)
  if (limit) params.set('limit', limit)
  const query = params.toString() ? `?${params.toString()}` : ''
  return request(`/api/users/${encodeURIComponent(username)}/books${query}`)
}

// --- Fil d'activité ---

export async function getFeed(token) {
  return request('/api/feed', { headers: authHeaders(token) })
}

export async function likePost(token, postId) {
  return request(`/api/feed/${postId}/like`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function unlikePost(token, postId) {
  return request(`/api/feed/${postId}/like`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export async function getComments(postId) {
  return request(`/api/feed/${postId}/comments`)
}

export async function addComment(token, postId, content) {
  return request(`/api/feed/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
  })
}

// --- Modération ---

// Pour l'instant, targetType = "image".
export async function createReport(token, targetType, targetId, reason) {
  return request('/api/reports', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
  })
}

// Admin seulement.
export async function getReports(token, statusFilter) {
  const query = statusFilter ? `?status=${statusFilter}` : ''
  return request(`/api/admin/reports${query}`, { headers: authHeaders(token) })
}

// Admin seulement.
export async function updateReport(token, reportId, status) {
  return request(`/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  })
}

// --- Clubs de lecture ---

export async function getClubs(token) {
  return request('/api/clubs', { headers: token ? authHeaders(token) : undefined })
}

export async function createClub(token, name, description) {
  return request('/api/clubs', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, description }),
  })
}

export async function getClub(token, clubId) {
  return request(`/api/clubs/${clubId}`, { headers: token ? authHeaders(token) : undefined })
}

// `updates` peut contenir { name, description, current_book } (tous optionnels).
export async function updateClub(token, clubId, updates) {
  return request(`/api/clubs/${clubId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  })
}

export async function deleteClub(token, clubId) {
  return request(`/api/clubs/${clubId}`, { method: 'DELETE', headers: authHeaders(token) })
}

export async function joinClub(token, clubId) {
  return request(`/api/clubs/${clubId}/join`, { method: 'POST', headers: authHeaders(token) })
}

export async function leaveClub(token, clubId) {
  return request(`/api/clubs/${clubId}/leave`, { method: 'DELETE', headers: authHeaders(token) })
}

export async function getClubMembers(clubId) {
  return request(`/api/clubs/${clubId}/members`)
}

export async function getClubMessages(token, clubId) {
  return request(`/api/clubs/${clubId}/messages`, { headers: authHeaders(token) })
}

export async function addClubMessage(token, clubId, content) {
  return request(`/api/clubs/${clubId}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
  })
}

export async function getClubVotes(token, clubId) {
  return request(`/api/clubs/${clubId}/votes`, { headers: authHeaders(token) })
}

export async function castClubVote(token, clubId, book) {
  return request(`/api/clubs/${clubId}/votes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ book }),
  })
}

export async function removeClubVote(token, clubId) {
  return request(`/api/clubs/${clubId}/votes`, { method: 'DELETE', headers: authHeaders(token) })
}
