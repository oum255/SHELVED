import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addNote,
  createReport,
  deleteBookImage,
  deleteNote,
  getBookImages,
  getLibraryBook,
  getNotes,
  getSessions,
  logSession,
  removeFromLibrary,
  updateLibraryBook,
  uploadBookImage,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import NavBar from '../components/NavBar'
import BookCover from '../components/BookCover'
import PhotoCapture from '../components/PhotoCapture'
import ConfirmModal from '../components/ConfirmModal'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { usePageTitle } from '../hooks/usePageTitle'
import './BookDetailPage.css'

const STATUSES = ['to_read', 'reading', 'read']

function BookDetailPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { userBookId } = useParams()
  const navigate = useNavigate()

  const [userBook, setUserBook] = useState(null)
  usePageTitle(userBook ? userBook.book.title : null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [notes, setNotes] = useState([])
  const [sessions, setSessions] = useState([])
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageInput, setPageInput] = useState(0)
  const [noteText, setNoteText] = useState('')
  const [notePage, setNotePage] = useState('')

  const [sessionPages, setSessionPages] = useState('')
  const [sessionMood, setSessionMood] = useState('')

  // Signalement d'une photo de la communauté : l'image visée (ou null = fermé).
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)

  const [uploadingCover, setUploadingCover] = useState(false)
  const [imageError, setImageError] = useState('')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const fileInputRef = useRef(null)

  const chooserBoxRef = useDialogA11y(() => setChooserOpen(false), chooserOpen)
  // Ref non attachée : le formulaire a son propre autoFocus, seul le comportement "Échap ferme" du hook sert ici.
  useDialogA11y(() => setReportTarget(null), reportTarget !== null)

  useEffect(() => {
    Promise.all([
      getLibraryBook(token, userBookId),
      getNotes(token, userBookId),
      getSessions(token, userBookId),
      getBookImages(token, userBookId),
    ])
      .then(([ub, ns, ss, imgs]) => {
        setUserBook(ub)
        setPageInput(ub.current_page)
        setNotes(ns)
        setSessions(ss)
        setImages(imgs)
      })
      .catch(() => setUserBook(false))
      .finally(() => setLoading(false))
  }, [token, userBookId])

  // Comportement "remplacer" : on retire d'abord mon ancienne photo de couverture avant d'envoyer la nouvelle.
  async function handleCoverUpload(file) {
    if (!file) return
    setImageError('')
    setUploadingCover(true)
    try {
      const mine = images.filter((i) => i.type === 'cover' && i.is_own)
      for (const old of mine) {
        try {
          await deleteBookImage(token, old.id)
        } catch {
          // on continue même si la suppression échoue
        }
      }
      const created = await uploadBookImage(token, userBookId, file)
      setImages((prev) => [
        created,
        ...prev.filter((i) => !(i.type === 'cover' && i.is_own)),
      ])
    } catch (err) {
      setImageError(err.message)
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleSendReport(event) {
    event.preventDefault()
    if (!reportReason.trim() || !reportTarget) return
    await createReport(token, 'image', reportTarget.id, reportReason.trim())
    setReportTarget(null)
    setReportReason('')
    setReportSent(true)
    setTimeout(() => setReportSent(false), 4000)
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
    handleCoverUpload(file)
    event.target.value = '' // permet de re-choisir le même fichier ensuite
  }

  async function handleLogSession(event) {
    event.preventDefault()
    const pages = Number(sessionPages)
    if (!pages || pages < 1) return
    const created = await logSession(token, userBookId, {
      pages_read: pages,
      mood: sessionMood || null,
    })
    setSessions((prev) => [created, ...prev])
    setSessionPages('')
    setSessionMood('')
    const refreshed = await getLibraryBook(token, userBookId)
    setUserBook(refreshed)
    setPageInput(refreshed.current_page)
  }

  async function applyChange(changes) {
    const updated = await updateLibraryBook(token, userBookId, changes)
    setUserBook(updated)
    setPageInput(updated.current_page)
  }

  async function handleRemove() {
    setConfirmRemove(false)
    setRemoving(true)
    try {
      await removeFromLibrary(token, userBookId)
      navigate('/')
    } finally {
      setRemoving(false)
    }
  }

  // Une avancée de page compte comme une vraie session de lecture (stats +
  // changement de statut auto, comme le formulaire plus bas) ; une correction
  // (page identique ou plus basse) reste une simple mise à jour sans session.
  async function handleSaveProgress() {
    const target = Number(pageInput)
    const delta = target - userBook.current_page
    if (delta > 0) {
      const created = await logSession(token, userBookId, { pages_read: delta })
      setSessions((prev) => [created, ...prev])
      const refreshed = await getLibraryBook(token, userBookId)
      setUserBook(refreshed)
      setPageInput(refreshed.current_page)
    } else {
      await applyChange({ current_page: target })
    }
  }

  async function handleAddNote(event) {
    event.preventDefault()
    if (!noteText.trim()) return
    const page = notePage ? Number(notePage) : null
    const created = await addNote(token, userBookId, noteText, page)
    setNotes((prev) => [created, ...prev])
    setNoteText('')
    setNotePage('')
  }

  async function handleDeleteNote(noteId) {
    await deleteNote(token, noteId)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  if (loading) return <div className="detail"><NavBar /></div>
  if (!userBook)
    return (
      <div className="detail">
        <NavBar />
        <main className="detail-content">
          <p>{t('detail.notFound')}</p>
          <Link to="/" className="detail-back">{t('detail.back')}</Link>
        </main>
      </div>
    )

  const book = userBook.book
  const total = book.pages || 0
  const percent = total ? Math.min(100, Math.round((pageInput / total) * 100)) : 0

  const customCover = images.find((i) => i.type === 'cover' && i.is_own)
  const coverUrl = customCover?.image_url || book.cover_url

  const communityImages = images.filter((i) => !i.is_own)

  return (
    <div className="detail">
      <NavBar />
      <main className="detail-content">
        <Link to="/" className="detail-back">{t('detail.back')}</Link>

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
            type="cover"
            onCapture={(file) => {
              handleCoverUpload(file)
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
              <button className="chooser-cancel" onClick={() => setChooserOpen(false)}>
                {t('images.cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="cover-center">
          <BookCover url={coverUrl} alt={book.title} className="detail-cover" />
          <button
            type="button"
            className="cover-change"
            onClick={() => setChooserOpen(true)}
          >
            {uploadingCover ? t('images.uploading') : t('images.change')}
          </button>
        </div>

        {imageError && (
          <p className="detail-error">{t(`images.errors.${imageError}`)}</p>
        )}

        {communityImages.length > 0 && (
          <section>
            <h2 className="detail-section-title">{t('moderation.communityPhotos')}</h2>
            <div className="image-grid">
              {communityImages.map((img) => (
                <div className="image-card" key={img.id}>
                  <img src={img.thumbnail_url || img.image_url} alt={img.type} />
                  <span className="image-type">
                    {t(`images.type${img.type[0].toUpperCase()}${img.type.slice(1)}`)}
                  </span>
                  <button
                    type="button"
                    className="image-delete"
                    onClick={() => setReportTarget(img)}
                  >
                    {t('moderation.report')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {reportSent && <p className="detail-success">{t('moderation.reportSent')}</p>}

        {reportTarget && (
          <div className="chooser-overlay" onClick={() => setReportTarget(null)}>
            <form
              className="chooser-box"
              role="dialog"
              aria-modal="true"
              aria-label={t('moderation.reportTitle')}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSendReport}
            >
              <p className="detail-label">{t('moderation.reportTitle')}</p>
              <textarea
                className="report-textarea"
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder={t('moderation.reportPlaceholder')}
                autoFocus
              />
              <button type="submit" className="chooser-option">
                {t('moderation.reportSend')}
              </button>
              <button
                type="button"
                className="chooser-cancel"
                onClick={() => setReportTarget(null)}
              >
                {t('moderation.reportCancel')}
              </button>
            </form>
          </div>
        )}

        <div className="detail-header">
          <div>
            <h1 className="detail-title">{book.title}</h1>
            <p className="detail-author">{book.author}</p>
          </div>
          <button
            type="button"
            className="detail-remove-btn"
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
          >
            {t('detail.remove')}
          </button>
        </div>

        <div className="detail-block">
          <span className="detail-label">{t('detail.statusLabel')}</span>
          <div className="status-buttons">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={userBook.status === s ? 'status-btn active' : 'status-btn'}
                onClick={() => applyChange({ status: s })}
              >
                {t(`library.status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="detail-block">
          <span className="detail-label">{t('detail.ratingLabel')}</span>
          <StarRating
            value={userBook.rating || 0}
            onChange={(r) => applyChange({ rating: r })}
          />
        </div>

        <div className="detail-block">
          <span className="detail-label">{t('detail.progressLabel')}</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="progress-row">
            <input
              type="number"
              min="0"
              max={total || undefined}
              value={pageInput}
              onChange={(e) => setPageInput(Number(e.target.value))}
            />
            {total > 0 && (
              <span className="muted">
                {t('detail.pageOf', { current: pageInput, total })} ({percent}%)
              </span>
            )}
            <button onClick={handleSaveProgress}>
              {t('detail.save')}
            </button>
          </div>
        </div>

        <div className="detail-infos">
          {book.pages && <span>{t('detail.infoPages')}: {book.pages}</span>}
          {book.publisher && <span>{t('detail.infoPublisher')}: {book.publisher}</span>}
          {book.published_date && <span>{t('detail.infoPublished')}: {book.published_date}</span>}
          {book.isbn && <span>{t('detail.infoIsbn')}: {book.isbn}</span>}
        </div>

        <section>
          <h2 className="detail-section-title">{t('detail.description')}</h2>
          <p className="detail-description">
            {book.description || t('detail.noDescription')}
          </p>
        </section>

        <section>
          <h2 className="detail-section-title">{t('sessions.title')}</h2>
          <form className="session-form" onSubmit={handleLogSession}>
            <input
              type="number"
              min="1"
              value={sessionPages}
              onChange={(e) => setSessionPages(e.target.value)}
              placeholder={t('sessions.pagesRead')}
            />
            <select value={sessionMood} onChange={(e) => setSessionMood(e.target.value)}>
              <option value="">{t('sessions.moodNone')}</option>
              {['happy', 'excited', 'relaxed', 'sad', 'bored'].map((m) => (
                <option key={m} value={m}>
                  {t(`sessions.moods.${m}`)}
                </option>
              ))}
            </select>
            <button type="submit">{t('sessions.log')}</button>
          </form>

          {sessions.length === 0 ? (
            <p className="muted">{t('sessions.empty')}</p>
          ) : (
            <ul className="session-list">
              {sessions.map((s) => (
                <li key={s.id} className="session-item">
                  <span className="session-date">{s.session_date}</span>
                  <span>{t('sessions.pagesCount', { count: s.pages_read })}</span>
                  {s.mood && (
                    <span className="session-mood">{t(`sessions.moods.${s.mood}`)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="detail-section-title">{t('detail.notesTitle')}</h2>
          <form className="note-form" onSubmit={handleAddNote}>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t('detail.notePlaceholder')}
              rows={2}
            />
            <div className="note-form-row">
              <input
                type="number"
                min="0"
                value={notePage}
                onChange={(e) => setNotePage(e.target.value)}
                placeholder={t('detail.notePagePlaceholder')}
              />
              <button type="submit">{t('detail.addNote')}</button>
            </div>
          </form>

          {notes.length === 0 ? (
            <p className="muted">{t('detail.noNotes')}</p>
          ) : (
            <ul className="note-list">
              {notes.map((n) => (
                <li key={n.id} className="note-item">
                  <div>
                    {n.page_number != null && (
                      <span className="note-page">{t('detail.atPage', { page: n.page_number })}</span>
                    )}
                    <span>{n.content}</span>
                  </div>
                  <button className="note-delete" onClick={() => handleDeleteNote(n.id)}>
                    {t('detail.deleteNote')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>

      {confirmRemove && (
        <ConfirmModal
          message={t('detail.removeConfirm')}
          confirmLabel={t('detail.remove')}
          cancelLabel={t('detail.removeCancel')}
          danger
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}

function StarRating({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={star <= value ? 'star filled' : 'star'}
          onClick={() => onChange(star)}
          aria-label={`${star}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default BookDetailPage
