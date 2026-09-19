import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchBooks } from '../api'
import BookCover from './BookCover'
import './BookSearchBox.css'

// Recherche Google Books réutilisable (choix du livre courant d'un club, proposition au vote).
function BookSearchBox({ placeholder, onPick, busy }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults(await searchBooks(query.trim()))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="club-book-search">
      <form onSubmit={handleSubmit} className="club-book-search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
        <button type="submit" disabled={searching}>
          {searching ? '…' : t('clubs.searchAction')}
        </button>
      </form>
      {results.length > 0 && (
        <ul className="club-book-results">
          {results.map((book) => (
            <li key={book.google_books_id || book.isbn || book.title} className="club-book-result">
              <BookCover url={book.cover_url} alt={book.title} className="club-book-result-cover" />
              <div className="club-book-result-info">
                <p className="club-book-result-title">{book.title}</p>
                {book.author && <p className="club-book-result-author">{book.author}</p>}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onPick(book)
                  setResults([])
                  setQuery('')
                }}
              >
                {t('clubs.pick')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BookSearchBox
