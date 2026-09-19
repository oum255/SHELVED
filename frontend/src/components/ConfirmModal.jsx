import { useDialogA11y } from '../hooks/useDialogA11y'
import './ConfirmModal.css'

// Remplace window.confirm (impossible à styliser). Le texte vient toujours de l'appelant, déjà traduit.
function ConfirmModal({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  const boxRef = useDialogA11y(onCancel)

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div
        className="confirm-modal-box"
        role="dialog"
        aria-modal="true"
        aria-label={title || message}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="confirm-modal-title">{title}</h2>}
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'confirm-modal-confirm danger' : 'confirm-modal-confirm'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
