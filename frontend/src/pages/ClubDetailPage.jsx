import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addClubMessage,
  castClubVote,
  deleteClub,
  getClub,
  getClubMembers,
  getClubMessages,
  getClubVotes,
  joinClub,
  leaveClub,
  removeClubVote,
  updateClub,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../toast/ToastContext'
import NavBar from '../components/NavBar'
import BookCover from '../components/BookCover'
import BookSearchBox from '../components/BookSearchBox'
import UserListModal from '../components/UserListModal'
import ClubVoteModal from '../components/ClubVoteModal'
import ConfirmModal from '../components/ConfirmModal'
import { usePageTitle } from '../hooks/usePageTitle'
import './ClubDetailPage.css'

function ClubDetailPage() {
  const { t } = useTranslation()
  const { clubId } = useParams()
  const { token, user: me } = useAuth()
  const navigate = useNavigate()
  const showToast = useToast()

  const [club, setClub] = useState(null)
  usePageTitle(club?.name)
  const [notFound, setNotFound] = useState(false)
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [votes, setVotes] = useState([])
  const [messageText, setMessageText] = useState('')
  const [busy, setBusy] = useState(false)
  // Fenêtre ouverte : 'members' | 'votes' | null.
  const [openModal, setOpenModal] = useState(null)
  // Confirmation en attente : 'leave' | 'delete' | null (remplace window.confirm, non stylisable).
  const [confirmAction, setConfirmAction] = useState(null)
  // Pour faire défiler automatiquement vers le dernier message.
  const messagesListRef = useRef(null)

  function loadClub() {
    getClub(token, clubId)
      .then(setClub)
      .catch(() => setNotFound(true))
  }

  useEffect(() => {
    setNotFound(false)
    loadClub()
    getClubMembers(clubId).then(setMembers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, token])

  useEffect(() => {
    if (!club?.is_member) return
    getClubMessages(token, clubId).then(setMessages)
    getClubVotes(token, clubId).then(setVotes)
  }, [club?.is_member, clubId, token])

  // Reste sur le dernier message à chaque nouvel envoi, plutôt que de laisser l'utilisateur au milieu d'une liste qui défile.
  useEffect(() => {
    const list = messagesListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  async function handleJoin() {
    setBusy(true)
    try {
      await joinClub(token, clubId)
      loadClub()
      getClubMembers(clubId).then(setMembers)
      showToast(t('clubs.toastJoined'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmLeave() {
    setConfirmAction(null)
    setBusy(true)
    try {
      await leaveClub(token, clubId)
      loadClub()
      getClubMembers(clubId).then(setMembers)
      showToast(t('clubs.toastLeft'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setConfirmAction(null)
    setBusy(true)
    try {
      await deleteClub(token, clubId)
      showToast(t('clubs.toastDeleted'))
      navigate('/clubs')
    } finally {
      setBusy(false)
    }
  }

  async function handleSetCurrentBook(book) {
    const updated = await updateClub(token, clubId, { current_book: book })
    setClub(updated)
    showToast(t('clubs.toastCurrentBookSet'))
  }

  async function handleSetCurrentBookById(bookId) {
    const updated = await updateClub(token, clubId, { current_book_id: bookId })
    setClub(updated)
    showToast(t('clubs.toastCurrentBookSet'))
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    const text = messageText.trim()
    if (!text) return
    const created = await addClubMessage(token, clubId, text)
    setMessages((prev) => [...prev, created])
    setMessageText('')
  }

  async function handleVote(book) {
    await castClubVote(token, clubId, book)
    getClubVotes(token, clubId).then(setVotes)
    showToast(t('clubs.toastVoted'))
  }

  async function handleRemoveVote() {
    await removeClubVote(token, clubId)
    getClubVotes(token, clubId).then(setVotes)
    showToast(t('clubs.toastVoteRemoved'))
  }

  if (notFound) {
    return (
      <div className="club-detail-page">
        <NavBar />
        <main className="club-detail-content">
          <p>{t('clubs.notFound')}</p>
          <Link to="/clubs" className="club-back">{t('clubs.back')}</Link>
        </main>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="club-detail-page">
        <NavBar />
        <main className="club-detail-content">
          <p className="muted">…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="club-detail-page">
      <NavBar />
      <main className="club-detail-content">
        <Link to="/clubs" className="club-back">{t('clubs.back')}</Link>

        <div className="club-header">
          <div>
            <h1 className="club-name">{club.name}</h1>
            {club.description && <p className="club-description">{club.description}</p>}
            <p className="club-meta">
              {t('clubs.ownedBy', { username: club.owner_username })}
            </p>
          </div>
          <div className="club-header-actions">
            <button type="button" className="club-header-btn" onClick={() => setOpenModal('members')}>
              {t('clubs.membersTitle')} · {club.member_count}
            </button>
            <button type="button" className="club-header-btn" onClick={() => setOpenModal('votes')}>
              {t('clubs.voteButton')}
            </button>
            {club.is_owner && (
              <button
                type="button"
                className="club-delete-btn"
                onClick={() => setConfirmAction('delete')}
                disabled={busy}
              >
                {t('clubs.delete')}
              </button>
            )}
            {!club.is_owner && club.is_member && (
              <button
                type="button"
                className="club-leave-btn"
                onClick={() => setConfirmAction('leave')}
                disabled={busy}
              >
                {t('clubs.leave')}
              </button>
            )}
            {!club.is_member && me && (
              <button type="button" className="club-join-btn" onClick={handleJoin} disabled={busy}>
                {t('clubs.join')}
              </button>
            )}
          </div>
        </div>

        <section className="club-section">
          <h2 className="club-section-title">{t('clubs.currentBook')}</h2>
          {club.current_book ? (
            <div className="club-current-book">
              <BookCover
                url={club.current_book.cover_url}
                alt={club.current_book.title}
                className="club-current-book-cover"
              />
              <div>
                <p className="club-current-book-title">{club.current_book.title}</p>
                {club.current_book.author && (
                  <p className="club-current-book-author">{club.current_book.author}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="muted">{t('clubs.noCurrentBook')}</p>
          )}
          {club.is_owner && (
            <BookSearchBox placeholder={t('clubs.searchPlaceholder')} onPick={handleSetCurrentBook} />
          )}
        </section>

        <section className="club-section">
          <h2 className="club-section-title">{t('clubs.discussionTitle')}</h2>
          {!club.is_member && <p className="muted">{t('clubs.discussionLocked')}</p>}
          {club.is_member && (
            <>
              <ul className="club-messages" ref={messagesListRef}>
                {messages.length === 0 && <li className="muted">{t('clubs.noMessages')}</li>}
                {messages.map((msg) => (
                  <li key={msg.id} className="club-message">
                    <Link to={`/u/${msg.username}`} className="club-message-username">
                      {msg.username}
                    </Link>
                    <span className="club-message-content">{msg.content}</span>
                  </li>
                ))}
              </ul>
              <form className="club-message-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('clubs.messagePlaceholder')}
                  maxLength={1000}
                />
                <button type="submit">{t('clubs.send')}</button>
              </form>
            </>
          )}
        </section>
      </main>

      {openModal === 'members' && (
        <UserListModal
          title={`${t('clubs.membersTitle')} · ${club.member_count}`}
          users={members}
          loading={false}
          onClose={() => setOpenModal(null)}
          emptyText={t('clubs.noMembers')}
          renderBadge={(u) =>
            u.role === 'owner' ? (
              <span className="user-list-badge">{t('clubs.ownerBadge')}</span>
            ) : null
          }
        />
      )}

      {openModal === 'votes' && (
        <ClubVoteModal
          votes={votes}
          loading={false}
          isMember={club.is_member}
          isOwner={club.is_owner}
          onClose={() => setOpenModal(null)}
          onVote={handleVote}
          onRemoveVote={handleRemoveVote}
          onSetCurrentBook={handleSetCurrentBookById}
        />
      )}

      {confirmAction === 'leave' && (
        <ConfirmModal
          message={t('clubs.leaveConfirm')}
          confirmLabel={t('clubs.leave')}
          cancelLabel={t('clubs.cancel')}
          onConfirm={confirmLeave}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === 'delete' && (
        <ConfirmModal
          message={t('clubs.deleteConfirm')}
          confirmLabel={t('clubs.delete')}
          cancelLabel={t('clubs.cancel')}
          danger
          onConfirm={confirmDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

export default ClubDetailPage
