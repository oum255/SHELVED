import { useEffect, useRef } from 'react'

// Comportement clavier standard des fenêtres modales : Échap referme, et si la
// ref est attachée à la boîte (tabIndex={-1}), le focus s'y déplace à l'ouverture
// (sinon il reste caché derrière pour qui navigue au clavier ou au lecteur d'écran).
//
// `active` sert aux fenêtres qui ne sont pas leur propre composant (ex: un menu
// conditionnel au milieu d'une page) : le hook doit toujours être appelé (règle
// des hooks), mais ne doit écouter Échap que pendant que la fenêtre est affichée.
export function useDialogA11y(onClose, active = true) {
  const boxRef = useRef(null)

  useEffect(() => {
    if (!active) return
    boxRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, active])

  return boxRef
}
