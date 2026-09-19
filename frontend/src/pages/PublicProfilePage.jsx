import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import {
  followUser,
  getFollowers,
  getFollowing,
  getProfile,
  getUserBooks,
  removeFollower,
  unfollowUser,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../toast/ToastContext'
import NavBar from '../components/NavBar'
import BookCover from '../components/BookCover'
import UserListModal from '../components/UserListModal'
import BooksModal from '../components/BooksModal'
import { usePageTitle } from '../hooks/usePageTitle'
import './PublicProfilePage.css'

function PublicProfilePage() {
  const { t } = useTranslation()
  const { username } = useParams()
  const { token, user: me } = useAuth()
  const showToast = useToast()
  usePageTitle(username)

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  // Mini-étagère (en cours + derniers lus) pour ne pas laisser la page vide sous les stats.
  const [readingBooks, setReadingBooks] = useState([])
  const [recentBooks, setRecentBooks] = useState([])

  // Fenêtre ouverte : 'followers' | 'following' | 'books' | null.
  const [modal, setModal] = useState(null)
  const [modalItems, setModalItems] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    getProfile(username, token)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    getUserBooks(username, 'reading', 6).then(setReadingBooks)
    getUserBooks(username, 'read', 10).then(setRecentBooks)
  }, [username, token])

  async function toggleFollow() {
    if (!profile) return
    setFollowBusy(true)
    try {
      if (profile.is_following) {
        await unfollowUser(token, username)
        setProfile((p) => ({ ...p, is_following: false, followers_count: p.followers_count - 1 }))
        showToast(t('profile.toastUnfollowed', { username }))
      } else {
        await followUser(token, username)
        setProfile((p) => ({ ...p, is_following: true, followers_count: p.followers_count + 1 }))
        showToast(t('profile.toastFollowed', { username }))
      }
    } finally {
      setFollowBusy(false)
    }
  }

  async function openModal(kind) {
    setModal(kind)
    setModalLoading(true)
    try {
      if (kind === 'followers') setModalItems(await getFollowers(username))
      else if (kind === 'following') setModalItems(await getFollowing(username))
      else if (kind === 'books') setModalItems(await getUserBooks(username, 'read'))
    } finally {
      setModalLoading(false)
    }
  }

  async function handleRemoveFollower(followerUsername) {
    await removeFollower(token, username, followerUsername)
    setModalItems((prev) => prev.filter((u) => u.username !== followerUsername))
    setProfile((p) => ({ ...p, followers_count: p.followers_count - 1 }))
  }

  async function handleUnfollowFromModal(targetUsername) {
    await unfollowUser(token, targetUsername)
    setModalItems((prev) => prev.filter((u) => u.username !== targetUsername))
    setProfile((p) => ({ ...p, following_count: p.following_count - 1 }))
  }

  return (
    <div className="profile-page">
      <NavBar />
      <main className="profile-content">
        {loading && <p className="muted">…</p>}

        {!loading && notFound && (
          <>
            <p>{t('profile.notFound')}</p>
            <Link to="/" className="profile-back">{t('detail.back')}</Link>
          </>
        )}

        {!loading && profile && (
          <>
            <div className="profile-header">
              <div className="profile-avatar">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} />
                ) : (
                  <span>{profile.username[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="profile-identity">
                <h1 className="profile-username">{profile.username}</h1>
                {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              </div>

              {me && !profile.is_me && (
                <button
                  type="button"
                  className={profile.is_following ? 'profile-follow-btn following' : 'profile-follow-btn'}
                  onClick={toggleFollow}
                  disabled={followBusy}
                >
                  {profile.is_following ? t('profile.unfollow') : t('profile.follow')}
                </button>
              )}
              {profile.is_me && (
                <Link to="/account" className="profile-edit-link">
                  {t('profile.editProfile')}
                </Link>
              )}
            </div>

            <div className="profile-stats">
              <button type="button" className="profile-stat" onClick={() => openModal('books')}>
                <strong>{profile.books_read_count}</strong>
                <span>{t('profile.booksRead')}</span>
              </button>
              <button type="button" className="profile-stat" onClick={() => openModal('followers')}>
                <strong>{profile.followers_count}</strong>
                <span>{t('profile.followers')}</span>
              </button>
              <button type="button" className="profile-stat" onClick={() => openModal('following')}>
                <strong>{profile.following_count}</strong>
                <span>{t('profile.following')}</span>
              </button>
              {profile.reading_goal && (
                <div className="profile-stat profile-stat-static">
                  <strong>{profile.reading_goal}</strong>
                  <span>{t('profile.goal')}</span>
                </div>
              )}
            </div>

            {readingBooks.length > 0 && (
              <section className="profile-shelf">
                <h2 className="profile-shelf-title">{t('profile.currentlyReading')}</h2>
                <div className="profile-shelf-grid">
                  {readingBooks.map((b, i) => (
                    <BookCover key={i} url={b.cover_url} alt={b.title} className="profile-shelf-cover" />
                  ))}
                </div>
              </section>
            )}

            {recentBooks.length > 0 && (
              <section className="profile-shelf">
                <h2 className="profile-shelf-title">{t('profile.recentlyRead')}</h2>
                <div className="profile-shelf-grid">
                  {recentBooks.map((b, i) => (
                    <BookCover key={i} url={b.cover_url} alt={b.title} className="profile-shelf-cover" />
                  ))}
                </div>
              </section>
            )}

            {readingBooks.length === 0 && recentBooks.length === 0 && (
              <p className="profile-shelf-empty muted">{t('profile.noBooks')}</p>
            )}
          </>
        )}

        {modal === 'followers' && (
          <UserListModal
            title={t('profile.followers')}
            users={modalItems}
            loading={modalLoading}
            onClose={() => setModal(null)}
            emptyText={t('profile.noFollowers')}
            actionLabel={profile?.is_me ? t('profile.remove') : undefined}
            onAction={profile?.is_me ? handleRemoveFollower : undefined}
          />
        )}
        {modal === 'following' && (
          <UserListModal
            title={t('profile.following')}
            users={modalItems}
            loading={modalLoading}
            onClose={() => setModal(null)}
            emptyText={t('profile.noFollowing')}
            actionLabel={profile?.is_me ? t('profile.unfollowAction') : undefined}
            onAction={profile?.is_me ? handleUnfollowFromModal : undefined}
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
      </main>
    </div>
  )
}

export default PublicProfilePage
