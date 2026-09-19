import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  addComment,
  followUser,
  getComments,
  getFeed,
  likePost,
  searchUsers,
  unfollowUser,
  unlikePost,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../toast/ToastContext'
import NavBar from '../components/NavBar'
import BookCover from '../components/BookCover'
import { usePageTitle } from '../hooks/usePageTitle'
import './FeedPage.css'

function FeedPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const showToast = useToast()
  usePageTitle(t('feed.title'))

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  // Ids des posts dont les commentaires sont dépliés.
  const [openComments, setOpenComments] = useState({})
  // Commentaires chargés par post : { [postId]: [...] }
  const [comments, setComments] = useState({})
  const [commentText, setCommentText] = useState({})

  // Recherche de lecteurs à suivre.
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [followedUsernames, setFollowedUsernames] = useState([])

  useEffect(() => {
    getFeed(token)
      .then(setPosts)
      .finally(() => setLoading(false))
  }, [token])

  // Petit délai avant la recherche pour ne pas interroger le serveur à chaque lettre tapée.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(() => {
      searchUsers(trimmed)
        .then(setResults)
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function toggleFollowFromSearch(username) {
    const alreadyFollowed = followedUsernames.includes(username)
    setFollowedUsernames((prev) =>
      alreadyFollowed ? prev.filter((u) => u !== username) : [...prev, username]
    )
    if (alreadyFollowed) {
      await unfollowUser(token, username)
      showToast(t('profile.toastUnfollowed', { username }))
    } else {
      await followUser(token, username)
      // Le fil peut désormais contenir l'activité de cette personne.
      getFeed(token).then(setPosts)
      showToast(t('profile.toastFollowed', { username }))
    }
  }

  async function toggleLike(post) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
          : p
      )
    )
    try {
      if (post.is_liked) {
        await unlikePost(token, post.id)
      } else {
        await likePost(token, post.id)
      }
    } catch {
      // en cas d'échec, on resynchronise depuis le serveur
      getFeed(token).then(setPosts)
    }
  }

  async function toggleComments(postId) {
    const isOpen = !!openComments[postId]
    setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }))
    if (!isOpen && !comments[postId]) {
      const list = await getComments(postId)
      setComments((prev) => ({ ...prev, [postId]: list }))
    }
  }

  async function handleAddComment(event, postId) {
    event.preventDefault()
    const text = (commentText[postId] || '').trim()
    if (!text) return
    const created = await addComment(token, postId, text)
    setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), created] }))
    setCommentText((prev) => ({ ...prev, [postId]: '' }))
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
    )
  }

  function actionText(post) {
    const params = { book: post.book_title }
    if (post.type === 'added_book') return t('feed.addedBook', params)
    if (post.type === 'finished_book') return t('feed.finishedBook', params)
    if (post.type === 'rated_book') return t('feed.ratedBook', { ...params, rating: post.content })
    return ''
  }

  return (
    <div className="feed-page">
      <NavBar />
      <main className="feed-content">
        <h1 className="feed-title">{t('feed.title')}</h1>

        <div className="feed-search">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('feed.searchPlaceholder')}
          />
          {searching && <span className="muted">…</span>}
          {results.length > 0 && (
            <ul className="feed-search-results">
              {results.map((r) => (
                <li key={r.username} className="feed-search-result">
                  <Link to={`/u/${r.username}`} className="feed-search-user">
                    <span className="feed-avatar feed-avatar--small">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt={r.username} />
                      ) : (
                        <span>{r.username[0]?.toUpperCase()}</span>
                      )}
                    </span>
                    {r.username}
                  </Link>
                  <button
                    type="button"
                    className={
                      followedUsernames.includes(r.username)
                        ? 'feed-follow-btn following'
                        : 'feed-follow-btn'
                    }
                    onClick={() => toggleFollowFromSearch(r.username)}
                  >
                    {followedUsernames.includes(r.username)
                      ? t('profile.unfollow')
                      : t('profile.follow')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {loading && <p className="muted">…</p>}
        {!loading && posts.length === 0 && <p className="muted">{t('feed.empty')}</p>}

        <ul className="feed-list">
          {posts.map((post) => (
            <li key={post.id} className="feed-card">
              <div className="feed-card-header">
                <Link to={`/u/${post.username}`} className="feed-avatar">
                  {post.avatar_url ? (
                    <img src={post.avatar_url} alt={post.username} />
                  ) : (
                    <span>{post.username[0]?.toUpperCase()}</span>
                  )}
                </Link>
                <div>
                  <p className="feed-action">
                    <Link to={`/u/${post.username}`} className="feed-username">
                      {post.username}
                    </Link>{' '}
                    {actionText(post)}
                  </p>
                  <time className="feed-date">
                    {new Date(post.created_at).toLocaleDateString()}
                  </time>
                </div>
              </div>

              {post.book_title && (
                <div className="feed-book">
                  <BookCover url={post.book_cover_url} alt={post.book_title} className="feed-book-cover" />
                  <div>
                    <p className="feed-book-title">{post.book_title}</p>
                    {post.book_author && <p className="feed-book-author">{post.book_author}</p>}
                  </div>
                </div>
              )}

              <div className="feed-card-actions">
                <button
                  type="button"
                  className={post.is_liked ? 'feed-like-btn liked' : 'feed-like-btn'}
                  onClick={() => toggleLike(post)}
                >
                  {t('feed.like')} · {post.likes_count}
                </button>
                <button
                  type="button"
                  className="feed-comment-btn"
                  onClick={() => toggleComments(post.id)}
                >
                  {t('feed.comments')} · {post.comments_count}
                </button>
              </div>

              {openComments[post.id] && (
                <div className="feed-comments">
                  <ul className="feed-comment-list">
                    {(comments[post.id] || []).map((c) => (
                      <li key={c.id} className="feed-comment-item">
                        <Link to={`/u/${c.username}`} className="feed-comment-username">
                          {c.username}
                        </Link>
                        <span>{c.content}</span>
                      </li>
                    ))}
                    {(comments[post.id] || []).length === 0 && (
                      <li className="muted">{t('feed.noComments')}</li>
                    )}
                  </ul>
                  <form
                    className="feed-comment-form"
                    onSubmit={(e) => handleAddComment(e, post.id)}
                  >
                    <input
                      type="text"
                      value={commentText[post.id] || ''}
                      onChange={(e) =>
                        setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder={t('feed.commentPlaceholder')}
                    />
                    <button type="submit">{t('feed.send')}</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

export default FeedPage
