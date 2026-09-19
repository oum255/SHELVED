import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  getRecommendations,
  refreshRecommendations,
  searchBooks,
  suggestBooks,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import NavBar from '../components/NavBar'
import BarcodeScanner from '../components/BarcodeScanner'
import BookCover from '../components/BookCover'
import { usePageTitle } from '../hooks/usePageTitle'
import './LibraryPage.css'

// Le drapeau n'est posé qu'à l'ouverture d'un aperçu et retiré au retour,
// pour ne restaurer la recherche que dans ce cas précis (pas au rechargement).
const LAST_SEARCH_KEY = 'shelved_last_search'
const RESTORE_FLAG = 'shelved_restore_search'

const AI_EXAMPLES = ['feelgood', 'fantasy', 'thriller', 'romance', 'scifi']

// Page de découverte : recommandations par défaut, puis recherche de livres.
function LibraryPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const navigate = useNavigate()
  usePageTitle(t('library.title'))

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null = pas de recherche active
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)

  // Recommandations (affichées avant toute recherche, si connecté).
  const [recs, setRecs] = useState(null) // null = en cours de chargement
  const [recsError, setRecsError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Barre "Demander à l'IA" : idées de lecture à partir d'une demande libre.
  const [aiQuery, setAiQuery] = useState('')
  const [aiResults, setAiResults] = useState(null) // null = on montre les recos par défaut
  const [aiAsked, setAiAsked] = useState('') // la demande affichée dans le titre
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (sessionStorage.getItem(RESTORE_FLAG) !== '1') return
    sessionStorage.removeItem(RESTORE_FLAG)
    const saved = sessionStorage.getItem(LAST_SEARCH_KEY)
    if (saved) {
      try {
        const { query: q, results: r } = JSON.parse(saved)
        setQuery(q)
        setResults(r)
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (!token) return
    getRecommendations(token)
      .then((list) => {
        setRecs(list)
        hydrateRecoCovers(list, setRecs)
      })
      .catch((err) => {
        setRecsError(err.message)
        setRecs([])
      })
  }, [token])

  // L'IA ne renvoie que titre/auteur : on récupère la couverture de chaque
  // livre via Google Books, et on garde l'objet complet pour l'ouvrir direct.
  async function hydrateRecoCovers(list, setter) {
    if (!list || list.length === 0) return
    const withCovers = await Promise.all(
      list.map(async (r) => {
        try {
          const q = [r.book_title, r.book_author].filter(Boolean).join(' ')
          const found = await searchBooks(q)
          const book = found[0] || null
          return { ...r, cover_url: book?.cover_url || null, book }
        } catch {
          return r // pas de couverture trouvée : on garde la carte sans image
        }
      }),
    )
    setter(withCovers)
  }

  // Lance une demande à l'IA (depuis le champ OU une étiquette-exemple).
  async function runAiAsk(rawQuery) {
    const q = (rawQuery || '').trim()
    if (!q || aiLoading) return
    setAiQuery(q)
    setAiError('')
    setAiLoading(true)
    setAiResults(null)
    setAiAsked(q)
    try {
      const list = await suggestBooks(token, q)
      setAiResults(list)
      hydrateRecoCovers(list, setAiResults)
    } catch (err) {
      setAiError(err.message)
      setAiResults([])
    } finally {
      setAiLoading(false)
    }
  }

  function handleAiAsk(event) {
    event.preventDefault()
    runAiAsk(aiQuery)
  }

  function clearAi() {
    setAiResults(null)
    setAiAsked('')
    setAiError('')
    setAiQuery('')
  }

  async function doSearch(searchQuery) {
    if (!searchQuery.trim()) return
    setError('')
    setSearching(true)
    try {
      const found = await searchBooks(searchQuery)
      setResults(found)
      sessionStorage.setItem(
        LAST_SEARCH_KEY,
        JSON.stringify({ query: searchQuery, results: found }),
      )
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    doSearch(query)
  }

  function handleScanned(code) {
    setShowScanner(false)
    const isbnQuery = `isbn:${code}`
    setQuery(isbnQuery)
    doSearch(isbnQuery)
  }

  // Efface la recherche → réaffiche les recommandations.
  function clearSearch() {
    setQuery('')
    setResults(null)
    setError('')
    sessionStorage.removeItem(LAST_SEARCH_KEY)
    sessionStorage.removeItem(RESTORE_FLAG)
  }

  function openSearchResult(book) {
    sessionStorage.setItem(RESTORE_FLAG, '1')
    navigate('/preview', { state: { book } })
  }

  // Envoie l'objet livre complet si on l'a déjà (couverture incluse), sinon une simple recherche.
  function openReco(r) {
    if (r.book) {
      navigate('/preview', { state: { book: r.book } })
    } else {
      const q = [r.book_title, r.book_author].filter(Boolean).join(' ')
      navigate('/preview', { state: { query: q } })
    }
  }

  async function handleRefresh() {
    setRecsError('')
    setRefreshing(true)
    try {
      const list = await refreshRecommendations(token)
      setRecs(list)
      hydrateRecoCovers(list, setRecs)
    } catch (err) {
      setRecsError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const showingAi = aiResults !== null
  const displayRecs = showingAi ? aiResults : recs

  return (
    <div className="library">
      <NavBar />

      <main className="library-content">
        <h1 className="library-title">{t('library.title')}</h1>

        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('library.searchPlaceholder')}
          />
          <button type="submit" disabled={searching}>
            {searching ? t('library.searching') : t('library.searchButton')}
          </button>
          <button type="button" className="scan-btn" onClick={() => setShowScanner(true)}>
            {t('library.scanButton')}
          </button>
        </form>

        {showScanner && (
          <BarcodeScanner
            onDetected={handleScanned}
            onClose={() => setShowScanner(false)}
          />
        )}

        {error && <p className="library-error">{t(`library.errors.${error}`)}</p>}

        {results !== null ? (
          /* ===== Résultats de recherche ===== */
          <section>
            <div className="section-row">
              <h2 className="section-title">{t('library.searchResults')}</h2>
              <button className="clear-btn" onClick={clearSearch}>
                {t('library.clearSearch')}
              </button>
            </div>
            {results.length === 0 && !error ? (
              <p className="muted">{t('library.noResults')}</p>
            ) : (
              <div className="book-grid">
                {results.map((book) => (
                  <button
                    key={book.google_books_id}
                    className="book-card book-clickable"
                    onClick={() => openSearchResult(book)}
                  >
                    <BookCover url={book.cover_url} alt={book.title} className="book-cover" />
                    <div className="book-info">
                      <p className="book-title">{book.title}</p>
                      <p className="book-author">{book.author || t('library.unknownAuthor')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : !token ? (
          /* ===== Visiteur non connecté ===== */
          <p className="muted reco-guest">{t('library.recoGuestHint')}</p>
        ) : (
          /* ===== Recommandations + barre "Demander à l'IA" ===== */
          <section>
            <div className="ai-panel">
              <p className="ai-panel-title">
                <span className="ai-panel-spark">✦</span> {t('ai.askTitle')}
              </p>
              <form className="ai-ask" onSubmit={handleAiAsk}>
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder={t('ai.askPlaceholder')}
                />
                <button type="submit" disabled={aiLoading}>
                  {aiLoading ? t('ai.asking') : t('ai.askButton')}
                </button>
              </form>
              <div className="ai-chips">
                {AI_EXAMPLES.map((key) => {
                  const label = t(`ai.ex.${key}`)
                  return (
                    <button
                      key={key}
                      type="button"
                      className="ai-chip"
                      onClick={() => runAiAsk(label)}
                      disabled={aiLoading}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="section-row">
              <h2 className="section-title">
                {showingAi ? t('ai.ideasFor', { query: aiAsked }) : t('ai.recoTitle')}
              </h2>
              {showingAi ? (
                <button className="clear-btn" onClick={clearAi}>
                  {t('ai.backToReco')}
                </button>
              ) : (
                <button className="clear-btn" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? t('ai.refreshing') : t('ai.refresh')}
                </button>
              )}
            </div>

            {aiError && <p className="library-error">{t(`ai.errors.${aiError}`)}</p>}
            {!showingAi && recsError && (
              <p className="library-error">{t(`ai.errors.${recsError}`)}</p>
            )}

            {aiLoading ? (
              <p className="muted">{t('ai.asking')}</p>
            ) : displayRecs === null ? (
              <p className="muted">{t('ai.generating')}</p>
            ) : displayRecs.length === 0 && !aiError && !recsError ? (
              <p className="muted">{showingAi ? t('ai.noIdeas') : t('ai.recoEmpty')}</p>
            ) : (
              <div className="reco-list">
                {displayRecs.map((r, i) => (
                  <button key={i} className="reco-card" onClick={() => openReco(r)}>
                    <BookCover
                      url={r.cover_url}
                      alt={r.book_title}
                      className="reco-cover"
                    />
                    <div className="reco-card-body">
                      <div className="reco-card-head">
                        <div>
                          <p className="reco-book-title">{r.book_title}</p>
                          {r.book_author && <p className="reco-book-author">{r.book_author}</p>}
                        </div>
                        {r.match_score != null && (
                          <span className="reco-match">{t('ai.match', { score: r.match_score })}</span>
                        )}
                      </div>
                      {r.reason && (
                        <p className="reco-reason">
                          <span className="reco-why">{t('ai.why')}</span> {r.reason}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default LibraryPage
