import { useTranslation } from 'react-i18next'
import { THEMES, useTheme } from '../theme/ThemeContext'

// Sélecteur de thème : liste les ambiances de THEMES.
function ThemeSwitcher() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <select
      className="lang-switcher"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      aria-label={t('theme.label')}
    >
      {THEMES.map((th) => (
        <option key={th.code} value={th.code}>
          {th.label}
        </option>
      ))}
    </select>
  )
}

export default ThemeSwitcher
