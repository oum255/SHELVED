import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { addToLibrary, getLibrary, reorderLibrary } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import NavBar from '../components/NavBar'
import BookCover from '../components/BookCover'
import { usePageTitle } from '../hooks/usePageTitle'
import { buildPyramidRows } from './bookshelfLayout'
import './BookshelfPage.css'

// Livre à ajouter mémorisé avant la connexion (même clé que BookPreviewPage/LibraryPage).
const PENDING_KEY = 'shelved_pending_book'
// Thèmes avec niche en terre cuite au lieu d'une étagère en bois (variables --niche-* dans index.css).
const NICHE_THEMES = ['corail']
// Thèmes "coin lecture" : étagère en bois normale + une lampe décorative en plus (.nook-lamp).
const NOOK_THEMES = ['nook']

function BookshelfPage() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const isNiche = NICHE_THEMES.includes(theme)
  const isNook = NOOK_THEMES.includes(theme)
  usePageTitle(t('nav.home'))

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  // Largeur dispo pour la niche : on écoute le resize de la fenêtre directement
  // (plus simple et fiable que de mesurer un élément après coup).
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0
  )
  useEffect(() => {
    function onResize() {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Glisser-déposer : appui long (~350 ms) pour "prendre" un livre, glisser pour le déplacer, relâcher pour le poser.
  const [draggingId, setDraggingId] = useState(null)
  const drag = useRef({ timer: null, x: 0, y: 0, id: null, active: false })
  const booksRef = useRef(books)
  useEffect(() => {
    booksRef.current = books
  }, [books])

  // Déplace `dragId` avant ou après `targetId` (réorganisation en direct).
  function reorderLive(dragId, targetId, after) {
    const arr = booksRef.current
    const from = arr.findIndex((b) => b.id === dragId)
    if (from < 0) return
    const next = [...arr]
    const [moved] = next.splice(from, 1)
    let idx = next.findIndex((b) => b.id === targetId)
    if (idx < 0) return
    if (after) idx += 1 // insère après le livre visé
    // Évite de re-déclencher inutilement si l'ordre ne change pas.
    if (next[idx]?.id === moved.id) return
    next.splice(idx, 0, moved)
    setBooks(next)
  }

  function onSlotPointerDown(e, ub) {
    const s = drag.current
    s.x = e.clientX
    s.y = e.clientY
    s.id = ub.id
    s.active = false

    s.timer = setTimeout(() => {
      s.active = true
      setDraggingId(ub.id)
    }, 350)

    const move = (ev) => {
      const moved = Math.hypot(ev.clientX - s.x, ev.clientY - s.y)
      if (!s.active) {
        // Mouvement avant l'appui long = défilement → on annule la prise.
        if (moved > 12) {
          clearTimeout(s.timer)
          cleanup()
        }
        return
      }
      ev.preventDefault() // empêche le défilement pendant le glissement
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const slot = el && el.closest('[data-ubid]')
      if (slot) {
        const targetId = Number(slot.dataset.ubid)
        if (targetId && targetId !== s.id) {
          // moitié droite du livre visé → insérer après (permet la dernière place)
          const rect = slot.getBoundingClientRect()
          const after = ev.clientX > rect.left + rect.width / 2
          reorderLive(s.id, targetId, after)
        }
      }
    }

    const up = (ev) => {
      clearTimeout(s.timer)
      if (s.active) {
        s.active = false
        setDraggingId(null)
        if (token) {
          reorderLibrary(token, booksRef.current.map((b) => b.id)).catch(() => {})
        }
      } else if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < 12) {
        // Appui court sans glissement = ouverture de la fiche.
        navigate(`/library/${s.id}`)
      }
      cleanup()
    }

    function cleanup() {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
    }

    document.addEventListener('pointermove', move, { passive: false })
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    async function load() {
      const pending = sessionStorage.getItem(PENDING_KEY)
      if (pending) {
        sessionStorage.removeItem(PENDING_KEY)
        try {
          await addToLibrary(token, JSON.parse(pending))
        } catch {
          // déjà présent ou erreur → on ignore
        }
      }
      const lib = await getLibrary(token)
      setBooks(lib)
      setLoading(false)
    }
    load()
  }, [token])

  // Pyramide de la niche unique : calculée seulement quand elle sert.
  const pyramid = isNiche ? buildPyramidRows(books, windowWidth - 100) : null

  return (
    <div className="bookshelf-page">
      <NavBar />

      {draggingId !== null && (
        <div className="shelf-move-banner">{t('bookshelf.reorderHint')}</div>
      )}

      {isNiche ? (
        <div className="niche-page">
          {books.length > 0 ? (
            // Pyramide qui suit la courbe de l'arc (peu de livres en haut, de plus en
            // plus en descendant) plutôt qu'un dôme vide au-dessus d'un simple rectangle.
            <div className="niche-scene niche-scene--single">
              <div className="niche-frame">
                <div className="niche-body niche-body--stacked" style={{ paddingTop: pyramid.paddingTop }}>
                  {pyramid.rows.map((group, i) => (
                    <div className="niche-books" key={i}>
                      {group.map((ub) => (
                        <button
                          key={ub.id}
                          type="button"
                          data-ubid={ub.id}
                          className={ub.id === draggingId ? 'shelf-slot moving' : 'shelf-slot'}
                          onPointerDown={(e) => onSlotPointerDown(e, ub)}
                          onContextMenu={(e) => e.preventDefault()}
                          title={ub.book.title}
                        >
                          <BookCover url={ub.book.cover_url} alt={ub.book.title} className="shelf-cover" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            !loading && (
              <div className="shelf-empty">
                <p className="shelf-empty-text">
                  {user ? t('bookshelf.emptyUser') : t('bookshelf.emptyGuest')}
                </p>
                <Link to="/library" className="shelf-empty-btn">
                  {t('bookshelf.discover')}
                </Link>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="bookcase">
          {isNook && (
            <div className="nook-lamp">
              <div className="nook-lamp-glow"></div>
              <div className="nook-lamp-pole"></div>
              <div className="nook-lamp-shade"></div>
            </div>
          )}
          <div className="crown"></div>
          <div className="bookcase-back">
            {books.length > 0 ? (
              <div className="shelf-grid">
                {books.map((ub) => (
                  <button
                    key={ub.id}
                    type="button"
                    data-ubid={ub.id}
                    className={ub.id === draggingId ? 'shelf-slot moving' : 'shelf-slot'}
                    onPointerDown={(e) => onSlotPointerDown(e, ub)}
                    onContextMenu={(e) => e.preventDefault()}
                    title={ub.book.title}
                  >
                    <BookCover url={ub.book.cover_url} alt={ub.book.title} className="shelf-cover" />
                  </button>
                ))}
              </div>
            ) : (
              !loading && (
                <div className="shelf-empty">
                  <p className="shelf-empty-text">
                    {user ? t('bookshelf.emptyUser') : t('bookshelf.emptyGuest')}
                  </p>
                  <Link to="/library" className="shelf-empty-btn">
                    {t('bookshelf.discover')}
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BookshelfPage
