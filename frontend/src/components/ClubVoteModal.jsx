import { useTranslation } from 'react-i18next'
import BookCover from './BookCover'
import BookSearchBox from './BookSearchBox'
import { useDialogA11y } from '../hooks/useDialogA11y'
import './ClubVoteModal.css'

// Fenêtre de vote pour le prochain livre d'un club : proposer un livre et voir/retirer les votes en cours.
function ClubVoteModal({
  votes,
  loading,
  isMember,
  isOwner,
  onClose,
  onVote,
  onRemoveVote,
  onSetCurrentBook,
}) {
  const { t } = useTranslation()
  const boxRef = useDialogA11y(onClose)

  return (
    <div className="club-vote-modal-overlay" onClick={onClose}>
      <div
        className="club-vote-modal-box"
        role="dialog"
        aria-modal="true"
        aria-label={t('clubs.voteTitle')}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="club-vote-modal-header">
          <h2>{t('clubs.voteTitle')}</h2>
          <button type="button" className="club-vote-modal-close" onClick={onClose} aria-label={t('profile.close')}>
            ×
          </button>
        </div>

        {!isMember && <p className="muted">{t('clubs.voteLocked')}</p>}

        {isMember && (
          <>
            <BookSearchBox placeholder={t('clubs.searchPlaceholder')} onPick={onVote} />

            {loading && <p className="muted">…</p>}
            {!loading && votes.length === 0 && <p className="muted">{t('clubs.noVotes')}</p>}

            <ul className="club-votes">
              {votes.map((v) => (
                <li key={v.book_id} className="club-vote">
                  <BookCover url={v.cover_url} alt={v.title} className="club-vote-cover" />
                  <div className="club-vote-info">
                    <p className="club-vote-title">{v.title}</p>
                    <p className="club-vote-count">{t('clubs.votesCount', { count: v.votes_count })}</p>
                  </div>
                  {v.voted_by_me && (
                    <button type="button" className="club-vote-remove" onClick={onRemoveVote}>
                      {t('clubs.removeVote')}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      className="club-vote-pick"
                      onClick={() => onSetCurrentBook(v.book_id)}
                    >
                      {t('clubs.setCurrentBook')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

export default ClubVoteModal
