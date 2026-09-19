import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

// Liste les langues de LANGUAGES ; changer la langue re-traduit toute l'app et le choix est mémorisé.
function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <select
      className="lang-switcher"
      value={i18n.resolvedLanguage}
      onChange={(event) => i18n.changeLanguage(event.target.value)}
      aria-label={t('language.label')}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  )
}

export default LanguageSwitcher
