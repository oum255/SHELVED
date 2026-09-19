import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDaySessions, getLibrary, getMoodSessions, getStats } from '../api'
import { useAuth } from '../auth/AuthContext'
import BookCover from '../components/BookCover'
import NavBar from '../components/NavBar'
import { usePageTitle } from '../hooks/usePageTitle'
import './StatsPage.css'

const pad = (n) => String(n).padStart(2, '0')
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth()

// Plus longue série de jours consécutifs parmi une liste de dates "YYYY-MM-DD".
function longestStreak(dates) {
  if (!dates.length) return 0
  const dayIndexes = [
    ...new Set(
      dates.map((s) => {
        const [y, m, d] = s.split('-').map(Number)
        return Date.UTC(y, m - 1, d) / 86400000 // numéro de jour, pour comparer des dates consécutives par soustraction
      }),
    ),
  ].sort((a, b) => a - b)
  let best = 1
  let cur = 1
  for (let i = 1; i < dayIndexes.length; i++) {
    cur = dayIndexes[i] === dayIndexes[i - 1] + 1 ? cur + 1 : 1
    if (cur > best) best = cur
  }
  return best
}

function StatsPage() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  usePageTitle(t('stats.title'))
  const [stats, setStats] = useState(null)

  // Liste de livres dépliée sous les cartes ("read" / "reading" / null = fermé).
  const [openStatus, setOpenStatus] = useState(null)
  const [books, setBooks] = useState([])
  const [loadingBooks, setLoadingBooks] = useState(false)

  // Mois/année affichés dans le calendrier de lecture (un mois à la fois).
  const [viewYear, setViewYear] = useState(CURRENT_YEAR)
  const [viewMonth, setViewMonth] = useState(CURRENT_MONTH)

  // Humeur sélectionnée (cliquable) + ses sessions.
  const [openMood, setOpenMood] = useState(null)
  const [moodSessions, setMoodSessions] = useState([])
  const [loadingMood, setLoadingMood] = useState(false)

  // Jour du calendrier cliqué (cliquable seulement s'il a été lu) + ses sessions.
  const [openDay, setOpenDay] = useState(null)
  const [daySessions, setDaySessions] = useState([])
  const [loadingDay, setLoadingDay] = useState(false)

  useEffect(() => {
    getStats(token).then(setStats).catch(() => setStats(false))
  }, [token])

  function toggleList(status) {
    if (openStatus === status) {
      setOpenStatus(null)
      return
    }
    setOpenStatus(status)
    setLoadingBooks(true)
    getLibrary(token, status)
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setLoadingBooks(false))
  }

  function toggleMood(mood) {
    if (openMood === mood) {
      setOpenMood(null)
      return
    }
    setOpenMood(mood)
    setLoadingMood(true)
    getMoodSessions(token, mood)
      .then(setMoodSessions)
      .catch(() => setMoodSessions([]))
      .finally(() => setLoadingMood(false))
  }

  function toggleDay(isoDate) {
    if (openDay === isoDate) {
      setOpenDay(null)
      return
    }
    setOpenDay(isoDate)
    setLoadingDay(true)
    getDaySessions(token, isoDate)
      .then(setDaySessions)
      .catch(() => setDaySessions([]))
      .finally(() => setLoadingDay(false))
  }

  if (!stats) return <div className="stats"><NavBar /></div>

  // Affiche le jour/mois (ex: "10/06").
  const formatDay = (isoDate) => {
    const [, month, day] = isoDate.split('-')
    return `${day}/${month}`
  }

  const hasData = stats.total_sessions > 0

  // Map "YYYY-MM-DD" -> pages lues ce jour (pour le calendrier).
  const dayMap = new Map(
    (stats.reading_calendar || []).map((d) => [d.date, d.pages]),
  )
  // Résumé de l'année affichée.
  const yearDays = (stats.reading_calendar || []).filter((d) =>
    d.date.startsWith(`${viewYear}-`),
  )
  const daysReadThisYear = yearDays.length
  const bestStreakThisYear = longestStreak(yearDays.map((d) => d.date))
  // Plus grand nombre de pages en un jour de l'année (intensité des couleurs).
  const maxPages = Math.max(1, ...yearDays.map((d) => d.pages))

  return (
    <div className="stats">
      <NavBar />
      <main className="stats-content">
        <h1 className="stats-title">{t('stats.title')}</h1>

        {/* Cartes de chiffres clés (terminés / en cours sont cliquables) */}
        <div className="stats-cards">
          <StatCard value={stats.total_pages_read} label={t('stats.totalPages')} />
          <StatCard
            value={stats.books_finished}
            label={t('stats.booksFinished')}
            onClick={() => toggleList('read')}
            active={openStatus === 'read'}
          />
          <StatCard
            value={stats.books_in_progress}
            label={t('stats.booksInProgress')}
            onClick={() => toggleList('reading')}
            active={openStatus === 'reading'}
          />
          <StatCard value={stats.current_streak} label={t('stats.streak')} />
        </div>

        {openStatus && (
          <div className="stats-book-list">
            {loadingBooks ? (
              <p className="muted">{t('preview.loading')}</p>
            ) : books.length === 0 ? (
              <p className="muted">{t('stats.noBooks')}</p>
            ) : (
              books.map((ub) => (
                <Link
                  key={ub.id}
                  to={`/library/${ub.id}`}
                  className="stats-book-item"
                >
                  <BookCover
                    url={ub.book.cover_url}
                    alt={ub.book.title}
                    className="stats-book-cover"
                  />
                  <div className="stats-book-info">
                    <span className="stats-book-title">{ub.book.title}</span>
                    <span className="stats-book-author">{ub.book.author}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {!hasData && (
          <div className="stats-empty">
            <h2 className="stats-empty-title">{t('stats.noDataTitle')}</h2>
            <p className="stats-empty-text">{t('stats.noData')}</p>
            <Link to="/library" className="stats-empty-cta">
              {t('stats.noDataCta')}
            </Link>
          </div>
        )}

        {hasData && (
          /* pages par jour, 30 derniers jours (fenêtre fixée côté backend) */
          <section>
            <h2 className="stats-section-title">{t('stats.pagesPerDay')}</h2>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.pages_per_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    interval={4}
                  />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={formatDay}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text)',
                    }}
                  />
                  <Bar dataKey="pages" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Toujours affiché même sans donnée, pour montrer à quoi ça ressemblera une fois loggé */}
        <section>
          <h2 className="stats-section-title">{t('stats.calendarTitle')}</h2>

          {/* Le total de pages n'est pas répété ici, déjà visible dans la carte "Pages lues" en haut */}
          <div className="cal-summary">
            <div className="cal-summary-item">
              <span className="cal-summary-value">{daysReadThisYear}</span>
              <span className="cal-summary-label">{t('stats.daysRead')}</span>
            </div>
            <div className="cal-summary-item">
              <span className="cal-summary-value">{bestStreakThisYear}</span>
              <span className="cal-summary-label">{t('stats.bestStreak')}</span>
            </div>
          </div>

          <BigMonth
            year={viewYear}
            month={viewMonth}
            dayMap={dayMap}
            maxPages={maxPages}
            locale={i18n.resolvedLanguage}
            pagesLabel={(p) => t('sessions.pagesCount', { count: p })}
            openDay={openDay}
            onDayClick={toggleDay}
            canNext={
              viewYear < CURRENT_YEAR ||
              (viewYear === CURRENT_YEAR && viewMonth < CURRENT_MONTH)
            }
            onPrev={() => {
              if (viewMonth === 0) {
                setViewMonth(11)
                setViewYear((y) => y - 1)
              } else {
                setViewMonth((m) => m - 1)
              }
            }}
            onNext={() => {
              if (viewMonth === 11) {
                setViewMonth(0)
                setViewYear((y) => y + 1)
              } else {
                setViewMonth((m) => m + 1)
              }
            }}
          />

          {openDay && (
            <div className="stats-book-list day-sessions">
              <h3 className="day-sessions-title">
                {(() => {
                  const [y, m, d] = openDay.split('-').map(Number)
                  return new Date(y, m - 1, d).toLocaleDateString(i18n.resolvedLanguage, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                })()}
              </h3>
              {loadingDay ? (
                <p className="muted">{t('preview.loading')}</p>
              ) : daySessions.length === 0 ? (
                <p className="muted">{t('stats.noDaySessions')}</p>
              ) : (
                daySessions.map((s, i) => (
                  <Link
                    key={i}
                    to={`/library/${s.user_book_id}`}
                    className="stats-book-item"
                  >
                    <BookCover
                      url={s.cover_url}
                      alt={s.title}
                      className="stats-book-cover"
                    />
                    <div className="stats-book-info">
                      <span className="stats-book-title">{s.title}</span>
                      <span className="stats-book-author">
                        {s.author} · {t('sessions.pagesCount', { count: s.pages_read })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </section>

        {hasData && Object.keys(stats.mood_distribution).length > 0 && (
          <section>
            <h2 className="stats-section-title">{t('stats.moodTitle')}</h2>
            <ul className="mood-list">
              {Object.entries(stats.mood_distribution).map(([mood, count]) => (
                <li key={mood}>
                  <button
                    className={
                      openMood === mood ? 'mood-item active' : 'mood-item'
                    }
                    onClick={() => toggleMood(mood)}
                  >
                    <span>{t(`stats.moods.${mood}`)}</span>
                    <span className="mood-count">{count}</span>
                  </button>
                </li>
              ))}
            </ul>

            {openMood && (
              <div className="stats-book-list mood-sessions">
                {loadingMood ? (
                  <p className="muted">{t('preview.loading')}</p>
                ) : moodSessions.length === 0 ? (
                  <p className="muted">{t('stats.noMoodSessions')}</p>
                ) : (
                  moodSessions.map((s, i) => (
                    <Link
                      key={i}
                      to={`/library/${s.user_book_id}`}
                      className="stats-book-item"
                    >
                      <BookCover
                        url={s.cover_url}
                        alt={s.title}
                        className="stats-book-cover"
                      />
                      <div className="stats-book-info">
                        <span className="stats-book-title">{s.title}</span>
                        <span className="stats-book-author">
                          {formatDay(s.session_date)} ·{' '}
                          {t('sessions.pagesCount', { count: s.pages_read })}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

// Calendrier d'UN mois (en grand) avec navigation ‹ ›.
function BigMonth({
  year,
  month,
  dayMap,
  maxPages,
  locale,
  pagesLabel,
  openDay,
  onDayClick,
  onPrev,
  onNext,
  canNext,
}) {
  const title = new Date(year, month, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Décalage du 1er jour (semaine commençant le lundi).
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7

  // 2024-01-01 est un lundi : repère pour générer les noms de jours (lun → dim) traduits.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }),
  )

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="cal-month-card">
      <div className="cal-month-head">
        <button className="calendar-arrow" onClick={onPrev} aria-label="‹">
          ‹
        </button>
        <span className="cal-month-title">{title}</span>
        <button
          className="calendar-arrow"
          onClick={onNext}
          disabled={!canNext}
          aria-label="›"
        >
          ›
        </button>
      </div>

      <div className="cal-weekdays-lg">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="cal-grid-lg">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="cal-day-lg blank" />
          const key = `${year}-${pad(month + 1)}-${pad(d)}`
          const pages = dayMap.get(key)
          if (!pages) {
            return (
              <span key={i} className="cal-day-lg">
                {d}
              </span>
            )
          }
          // Intensité : plus on a lu, plus c'est marqué.
          const intensity = 0.45 + 0.55 * Math.min(1, pages / maxPages)
          return (
            <button
              key={i}
              type="button"
              className={
                openDay === key ? 'cal-day-lg read active' : 'cal-day-lg read'
              }
              title={`${key} — ${pagesLabel(pages)}`}
              onClick={() => onDayClick(key)}
            >
              <span
                className="cal-day-fill"
                style={{ opacity: intensity }}
                aria-hidden="true"
              />
              <span className="cal-day-num">{d}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ value, label, onClick, active }) {
  // Carte cliquable si on lui passe `onClick`, sinon simple affichage.
  const className = [
    'stat-card',
    onClick ? 'stat-card--clickable' : '',
    active ? 'stat-card--active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!onClick) {
    return (
      <div className={className}>
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  )
}

export default StatsPage
