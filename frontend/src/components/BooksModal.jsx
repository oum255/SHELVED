import { useTranslation } from 'react-i18next'
import BookCover from './BookCover'
import { useDialogA11y } from '../hooks/useDialogA11y'
import './BooksModal.css'

// Fenêtre listant des livres (ex: la liste "Lus" d'un utilisateur).
function BooksModal({ title, books, loading, onClose, emptyText }) {
  const { t } = useTranslation()
  const boxRef = useDialogA11y(onClose)

  return (
    <div className="books-modal-overlay" onClick={onClose}>
      <div
        className="books-modal-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="books-modal-header">
          <h2>{title}</h2>
          <button type="button" className="books-modal-close" onClick={onClose} aria-label={t('profile.close')}>
            ×
          </button>
        </div>

        {loading && <p className="muted">…</p>}
        {!loading && books.length === 0 && <p className="muted">{emptyText}</p>}

        <ul className="books-modal-list">
          {books.map((b, i) => (
            <li key={i} className="books-modal-item">
              <BookCover url={b.cover_url} alt={b.title} className="books-modal-cover" />
              <div>
                <p className="books-modal-title">{b.title}</p>
                {b.author && <p className="books-modal-author">{b.author}</p>}
                {b.rating && <span className="books-modal-rating">{'★'.repeat(b.rating)}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default BooksModal
