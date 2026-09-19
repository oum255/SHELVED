import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { usePageTitle } from '../hooks/usePageTitle'
import './LegalPage.css'

// Sections de la politique de confidentialité (clé de titre + clé de texte).
const SECTIONS = [
  ['dataTitle', 'data'],
  ['aiTitle', 'ai'],
  ['thirdTitle', 'third'],
  ['rightsTitle', 'rights'],
  ['contactTitle', 'contact'],
]

function PrivacyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  usePageTitle(t('privacy.title'))
  return (
    <div className="legal">
      <NavBar />
      <main className="legal-content">
        <button className="legal-back" onClick={() => navigate(-1)}>{t('legal.back')}</button>
        <h1 className="legal-title">{t('privacy.title')}</h1>
        <p className="legal-updated">{t('legal.updated')}</p>

        <section className="legal-section">
          <p>{t('privacy.intro')}</p>
        </section>

        {SECTIONS.map(([titleKey, textKey]) => (
          <section className="legal-section" key={titleKey}>
            <h2 className="legal-section-title">{t(`privacy.${titleKey}`)}</h2>
            <p>{t(`privacy.${textKey}`)}</p>
          </section>
        ))}
      </main>
    </div>
  )
}

export default PrivacyPage
