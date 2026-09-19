// Configuration i18n, importée une seule fois au démarrage (dans main.jsx).

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Pour ajouter une langue : fichier xx.json dans /locales, l'importer ici, l'ajouter à LANGUAGES.
import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'
import it from './locales/it.json'
import de from './locales/de.json'
import pt from './locales/pt.json'
import ar from './locales/ar.json'

// Liste des langues proposées (code + nom affiché dans sa propre langue).
export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
]

const RTL_LANGUAGES = ['ar']

i18n
  // Détecte automatiquement la langue (choix mémorisé, sinon navigateur).
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
      it: { translation: it },
      de: { translation: de },
      pt: { translation: pt },
      ar: { translation: ar },
    },
    fallbackLng: 'fr',
    supportedLngs: LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Applique le sens d'écriture selon la langue et met à jour l'attribut lang.
function applyDirection(lng) {
  const dir = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lng)
}

applyDirection(i18n.resolvedLanguage)
i18n.on('languageChanged', applyDirection)

export default i18n
