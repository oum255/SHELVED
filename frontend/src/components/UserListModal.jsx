import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useDialogA11y } from '../hooks/useDialogA11y'
import './UserListModal.css'

// Fenêtre listant des utilisateurs (abonnés, membres d'un club...), avec bouton
// d'action optionnel par ligne (ex: "Retirer") et badge optionnel (ex: "Créateur").
function UserListModal({
  title,
  users,
  loading,
  onClose,
  actionLabel,
  onAction,
  emptyText,
  renderBadge,
}) {
  const { t } = useTranslation()
  const boxRef = useDialogA11y(onClose)

  return (
    <div className="user-list-overlay" onClick={onClose}>
      <div
        className="user-list-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="user-list-header">
          <h2>{title}</h2>
          <button type="button" className="user-list-close" onClick={onClose} aria-label={t('profile.close')}>
            ×
          </button>
        </div>

        {loading && <p className="muted">…</p>}
        {!loading && users.length === 0 && <p className="muted">{emptyText}</p>}

        <ul className="user-list">
          {users.map((u) => (
            <li key={u.username} className="user-list-item">
              <Link to={`/u/${u.username}`} onClick={onClose} className="user-list-link">
                <span className="user-list-avatar">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} />
                  ) : (
                    <span>{u.username[0]?.toUpperCase()}</span>
                  )}
                </span>
                {u.username}
              </Link>
              {renderBadge && renderBadge(u)}
              {onAction && (
                <button
                  type="button"
                  className="user-list-action"
                  onClick={() => onAction(u.username)}
                >
                  {actionLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default UserListModal
