import { useEffect } from 'react'

// Titre d'onglet distinct par page (plutôt que toujours "SHELVED") : utile pour
// s'y retrouver entre onglets, et annoncé par les lecteurs d'écran à la navigation.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · SHELVED` : 'SHELVED'
    return () => {
      document.title = 'SHELVED'
    }
  }, [title])
}
