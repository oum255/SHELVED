import { createContext, useCallback, useContext, useRef, useState } from 'react'
import './Toast.css'

// Message temporaire ("Abonné·e !", "Vote enregistré"…) affiché en bas d'écran
// après une action qui, sinon, changerait l'interface en silence.
const ToastContext = createContext(null)

const TOAST_DURATION_MS = 2800

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const showToast = useCallback((message) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Renvoie showToast(message), à appeler après une action réussie.
export function useToast() {
  return useContext(ToastContext)
}
