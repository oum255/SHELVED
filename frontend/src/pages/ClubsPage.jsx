import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { createClub, getClubs, joinClub } from '../api'
import { useAuth } from '../auth/AuthContext'
import NavBar from '../components/NavBar'
import BookCover from '../components/BookCover'
import { usePageTitle } from '../hooks/usePageTitle'
import './ClubsPage.css'

function ClubsPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const navigate = useNavigate()
  usePageTitle(t('clubs.title'))

  const [clubs, setClubs] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    getClubs(token).then(setClubs)
  }, [token])

  async function handleCreate(event) {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const club = await createClub(token, name.trim(), description.trim() || null)
      navigate(`/clubs/${club.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(club) {
    setBusyId(club.id)
    try {
      await joinClub(token, club.id)
      navigate(`/clubs/${club.id}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="clubs-page">
      <NavBar />
      <main className="clubs-content">
        <div className="clubs-header">
          <div>
            <h1 className="clubs-title">{t('clubs.title')}</h1>
            <p className="clubs-subtitle">{t('clubs.subtitle')}</p>
          </div>
          <button
            type="button"
            className="clubs-create-btn"
            onClick={() => setShowCreate((v) => !v)}
          >
            {t('clubs.create')}
          </button>
        </div>

        {showCreate && (
          <form className="clubs-create-form" onSubmit={handleCreate}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('clubs.namePlaceholder')}
              minLength={3}
              maxLength={100}
              required
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('clubs.descriptionPlaceholder')}
              maxLength={500}
              rows={2}
            />
            <div className="clubs-create-actions">
              <button type="button" className="clubs-cancel-btn" onClick={() => setShowCreate(false)}>
                {t('clubs.cancel')}
              </button>
              <button type="submit" className="clubs-submit-btn" disabled={creating}>
                {t('clubs.create')}
              </button>
            </div>
          </form>
        )}

        {clubs === null && <p className="muted">…</p>}
        {clubs !== null && clubs.length === 0 && <p className="muted">{t('clubs.empty')}</p>}

        <ul className="clubs-list">
          {clubs?.map((club) => (
            <li key={club.id} className="club-card">
              <Link to={`/clubs/${club.id}`} className="club-card-main">
                {club.current_book ? (
                  <BookCover
                    url={club.current_book.cover_url}
                    alt={club.current_book.title}
                    className="club-card-cover"
                  />
                ) : (
                  <div className="club-card-cover club-card-cover-empty" />
                )}
                <div className="club-card-info">
                  <p className="club-card-name">{club.name}</p>
                  {club.description && <p className="club-card-desc">{club.description}</p>}
                  <p className="club-card-meta">
                    {t('clubs.membersCount', { count: club.member_count })}
                    {club.current_book && ` · ${club.current_book.title}`}
                  </p>
                </div>
              </Link>
              {club.is_member ? (
                <Link to={`/clubs/${club.id}`} className="club-card-badge">
                  {t('clubs.joined')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="club-card-join-btn"
                  onClick={() => handleJoin(club)}
                  disabled={busyId === club.id}
                >
                  {t('clubs.join')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

export default ClubsPage
