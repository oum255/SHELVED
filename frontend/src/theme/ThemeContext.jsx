// Thème de couleurs choisi, partagé dans toute l'app : pose data-theme sur
// <html>, le CSS (index.css) fait le reste. Choix mémorisé dans le navigateur.

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const THEME_KEY = 'shelved_theme'

// code = valeur CSS data-theme ; label = nom affiché dans le sélecteur.
export const THEMES = [
  { code: 'corail', label: 'Niche Corail' },
  { code: 'nook', label: 'Coin lecture' },
  { code: 'wine', label: 'Bordeaux velours' },
  { code: 'emerald', label: 'Émeraude joaillerie' },
]

const VALID = THEMES.map((t) => t.code)
const DEFAULT_THEME = 'corail'

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return VALID.includes(saved) ? saved : DEFAULT_THEME
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  function setTheme(newTheme) {
    if (!VALID.includes(newTheme)) return
    localStorage.setItem(THEME_KEY, newTheme)
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
