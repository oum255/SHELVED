import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { addToLibrary, searchBooks } from '../api'
import { useAuth } from '../auth/AuthContext'
import BookCover from '../components/BookCover'
import NavBar from '../components/NavBar'
import { usePageTitle } from '../hooks/usePageTitle'
import './BookPreviewPage.css'

// Même clé que LibraryPage / BookshelfPage (livre mémorisé avant connexion).
const PENDING_KEY = 'shelved_pending_book'

// Nom lisible d'une langue (ex: "en" -> "anglais"), dans la langue de l'interface.
function languageName(code, uiLang) {
  if (!code) return null
  try {
    return new Intl.DisplayNames([uiLang], { type: 'language' }).of(code)
  } catch {
    return code.toUpperCase()
  }
}

function BookPreviewPage() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [book, setBook] = useState(location.state?.book || null)
  usePageTitle(book?.title)
  const [loading, setLoading] = useState(!location.state?.book)
  const [addState, setAddState] = useState('idle') // idle | adding | added | already
  const [error, setError] = useState('')

  // Si on est arrivé avec une "query" (depuis une reco), on cherche le livre.
  useEffect(() => {
    const query = location.state?.query
    if (book || !query) return
    searchBooks(query)
      .then((results) => setBook(results[0] || false))
      .catch(() => setBook(false))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    setError('')
    if (!token) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(book))
      navigate('/login')
      return
    }
    setAddState('adding')
    try {
      await addToLibrary(token, book)
      setAddState('added')
    } catch (err) {
      if (err.message === 'book_already_in_library') {
        setAddState('already')
      } else {
        setAddState('idle')
        setError(err.message)
      }
    }
  }

  return (
    <div className="preview">
      <NavBar />
      <main className="preview-content">
        <button className="preview-back" onClick={() => navigate(-1)}>
          {t('preview.back')}
        </button>

        {loading ? (
          <p className="preview-muted">{t('preview.loading')}</p>
        ) : !book ? (
          <p className="preview-muted">{t('preview.notFound')}</p>
        ) : (
          <>
            <div className="preview-head">
              <BookCover url={book.cover_url} alt={book.title} className="preview-cover" />
              <div className="preview-main">
                <h1 className="preview-title">{book.title}</h1>
                <p className="preview-author">{book.author || t('library.unknownAuthor')}</p>

                {addState === 'added' ? (
                  <span className="preview-added">{t('preview.added')}</span>
                ) : addState === 'already' ? (
                  <span className="preview-added">{t('preview.alreadyInLibrary')}</span>
                ) : (
                  <button
                    className="preview-add"
                    onClick={handleAdd}
                    disabled={addState === 'adding'}
                  >
                    {addState === 'adding' ? t('preview.adding') : t('preview.add')}
                  </button>
                )}
                {error && <p className="preview-error">{t(`library.errors.${error}`)}</p>}
              </div>
            </div>

            <div className="preview-infos">
              {book.pages && <span>{t('detail.infoPages')}: {book.pages}</span>}
              {book.publisher && <span>{t('detail.infoPublisher')}: {book.publisher}</span>}
              {book.published_date && <span>{t('detail.infoPublished')}: {book.published_date}</span>}
              {book.language && (
                <span>{t('preview.language')}: {languageName(book.language, i18n.resolvedLanguage)}</span>
              )}
              {book.isbn && <span>{t('detail.infoIsbn')}: {book.isbn}</span>}
            </div>

            <section>
              <h2 className="preview-section-title">{t('detail.description')}</h2>
              <p className="preview-description">
                {book.description || t('detail.noDescription')}
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default BookPreviewPage
