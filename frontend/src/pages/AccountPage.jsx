import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getFollowers,
  getFollowing,
  getProfile,
  getUserBooks,
  removeFollower,
  unfollowUser,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import NavBar from '../components/NavBar'
import UserListModal from '../components/UserListModal'
import BooksModal from '../components/BooksModal'
import PhotoCapture from '../components/PhotoCapture'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { usePageTitle } from '../hooks/usePageTitle'
import './AccountPage.css'

function AccountPage() {
  const { t } = useTranslation()
  const { user, token, updateProfile, uploadAvatar, removeAvatar } = useAuth()
  usePageTitle(t('account.title'))

  const [stats, setStats] = useState(null)
  useEffect(() => {
    if (user) getProfile(user.username, token).then(setStats).catch(() => {})
  }, [user?.username, token])

  // Fenêtre ouverte : 'followers' | 'following' | 'books' | null.
  const [modal, setModal] = useState(null)
  const [modalItems, setModalItems] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  async function openModal(kind) {
    setModal(kind)
    setModalLoading(true)
    try {
      if (kind === 'followers') setModalItems(await getFollowers(user.username))
      else if (kind === 'following') setModalItems(await getFollowing(user.username))
      else if (kind === 'books') setModalItems(await getUserBooks(user.username, 'read'))
    } finally {
      setModalLoading(false)
    }
  }

  async function handleRemoveFollower(followerUsername) {
    await removeFollower(token, user.username, followerUsername)
    setModalItems((prev) => prev.filter((u) => u.username !== followerUsername))
    setStats((s) => ({ ...s, followers_count: s.followers_count - 1 }))
  }

  async function handleUnfollowFromModal(targetUsername) {
    await unfollowUser(token, targetUsername)
    setModalItems((prev) => prev.filter((u) => u.username !== targetUsername))
    setStats((s) => ({ ...s, following_count: s.following_count - 1 }))
  }

  // --- Photo de profil ---
  const [chooserOpen, setChooserOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef(null)
  const chooserBoxRef = useDialogA11y(() => setChooserOpen(false), chooserOpen)

  async function handleAvatarFile(file) {
    if (!file) return
    setAvatarError('')
    setAvatarUploading(true)
    try {
      await uploadAvatar(file)
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setAvatarUploading(false)
    }
  }

  function chooseCamera() {
    setCaptureOpen(true)
    setChooserOpen(false)
  }

  function chooseGallery() {
    setChooserOpen(false)
    fileInputRef.current?.click()
  }

  function handleFilePicked(event) {
    const file = event.target.files[0]
    handleAvatarFile(file)
    event.target.value = ''
  }

  async function handleRemoveAvatar() {
    setChooserOpen(false)
    setAvatarError('')
    try {
      await removeAvatar()
    } catch (err) {
      setAvatarError(err.message)
    }
  }

  // --- Bio + objectif de lecture (profil public) ---
  const [editingProfile, setEditingProfile] = useState(false)
  const [bio, setBio] = useState('')
  const [readingGoal, setReadingGoal] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setBio(user.bio || '')
      setReadingGoal(user.reading_goal ? String(user.reading_goal) : '')
    }
  }, [user])

  async function handleSaveProfile(event) {
    event.preventDefault()
    setSavingProfile(true)
    try {
      await updateProfile({
        bio: bio.trim() || null,
        reading_goal: readingGoal ? Number(readingGoal) : null,
      })
      setEditingProfile(false)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="account">
      <NavBar />
      <main className="account-content">
        <div className="account-header">
          {/* Champ fichier caché (ouvert par "Choisir une photo") */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFilePicked}
          />

          {captureOpen && (
            <PhotoCapture
              type="avatar"
              onCapture={(file) => {
                handleAvatarFile(file)
                setCaptureOpen(false)
              }}
              onClose={() => setCaptureOpen(false)}
            />
          )}

          {chooserOpen && (
            <div className="chooser-overlay" onClick={() => setChooserOpen(false)}>
              <div
                className="chooser-box"
                role="dialog"
                aria-modal="true"
                aria-label={t('images.choose')}
                ref={chooserBoxRef}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="chooser-option" onClick={chooseCamera}>
                  {t('images.takePhoto')}
                </button>
                <button className="chooser-option" onClick={chooseGallery}>
                  {t('images.choose')}
                </button>
                {user?.avatar_url && (
                  <button className="chooser-option" onClick={handleRemoveAvatar}>
                    {t('images.removePhoto')}
                  </button>
                )}
                <button className="chooser-cancel" onClick={() => setChooserOpen(false)}>
                  {t('images.cancel')}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="account-avatar"
            onClick={() => setChooserOpen(true)}
            disabled={avatarUploading}
            aria-label={t('images.change')}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} />
            ) : (
              <span>{user?.username?.[0]?.toUpperCase()}</span>
            )}
            <span className="account-avatar-edit">
              {avatarUploading ? '…' : '✎'}
            </span>
          </button>
          <div className="account-identity">
            <h1 className="account-username">{user?.username}</h1>
            {user?.bio && <p className="account-bio">{user.bio}</p>}
          </div>
          <button
            type="button"
            className="account-edit-btn"
            onClick={() => setEditingProfile((v) => !v)}
          >
            {editingProfile ? t('account.cancel') : t('profile.editProfile')}
          </button>
        </div>
        {avatarError && (
          <p className="account-error">{t(`images.errors.${avatarError}`)}</p>
        )}

        {stats && (
          <div className="account-stats">
            <button type="button" className="account-stat" onClick={() => openModal('books')}>
              <strong>{stats.books_read_count}</strong>
              <span>{t('profile.booksRead')}</span>
            </button>
            <button type="button" className="account-stat" onClick={() => openModal('followers')}>
              <strong>{stats.followers_count}</strong>
              <span>{t('profile.followers')}</span>
            </button>
            <button type="button" className="account-stat" onClick={() => openModal('following')}>
              <strong>{stats.following_count}</strong>
              <span>{t('profile.following')}</span>
            </button>
            {user?.reading_goal && (
              <div className="account-stat account-stat-static">
                <strong>{user.reading_goal}</strong>
                <span>{t('profile.goal')}</span>
              </div>
            )}
          </div>
        )}

        {modal === 'followers' && (
          <UserListModal
            title={t('profile.followers')}
            users={modalItems}
            loading={modalLoading}
            onClose={() => setModal(null)}
            emptyText={t('profile.noFollowers')}
            actionLabel={t('profile.remove')}
            onAction={handleRemoveFollower}
          />
        )}
        {modal === 'following' && (
          <UserListModal
            title={t('profile.following')}
            users={modalItems}
            loading={modalLoading}
            onClose={() => setModal(null)}
            emptyText={t('profile.noFollowing')}
            actionLabel={t('profile.unfollowAction')}
            onAction={handleUnfollowFromModal}
          />
        )}
        {modal === 'books' && (
          <BooksModal
            title={t('profile.booksRead')}
            books={modalItems}
            loading={modalLoading}
            onClose={() => setModal(null)}
            emptyText={t('profile.noBooks')}
          />
        )}

        {editingProfile && (
          <form onSubmit={handleSaveProfile} className="account-profile-form">
            <label className="account-profile-field">
              {t('account.bioLabel')}
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder={t('account.bioPlaceholder')}
              />
            </label>
            <label className="account-profile-field">
              {t('account.readingGoalLabel')}
              <input
                type="number"
                min="1"
                max="1000"
                value={readingGoal}
                onChange={(e) => setReadingGoal(e.target.value)}
                placeholder={t('account.readingGoalPlaceholder')}
              />
            </label>
            <button type="submit" className="account-save-btn" disabled={savingProfile}>
              {savingProfile ? t('account.saving') : t('account.save')}
            </button>
          </form>
        )}
        {profileSaved && <p className="account-saved-notice">{t('account.saved')}</p>}
      </main>
    </div>
  )
}

export default AccountPage
