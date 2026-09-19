import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { usePageTitle } from '../hooks/usePageTitle'
import './LegalPage.css'

// Sections des conditions générales d'utilisation (clé de titre + clé de texte).
const SECTIONS = [
  ['useTitle', 'use'],
  ['accountTitle', 'account'],
  ['contentTitle', 'content'],
  ['aiTitle', 'ai'],
  ['liabilityTitle', 'liability'],
  ['changesTitle', 'changes'],
]

function TermsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  usePageTitle(t('terms.title'))
  return (
    <div className="legal">
      <NavBar />
      <main className="legal-content">
        <button className="legal-back" onClick={() => navigate(-1)}>{t('legal.back')}</button>
        <h1 className="legal-title">{t('terms.title')}</h1>
        <p className="legal-updated">{t('legal.updated')}</p>

        <section className="legal-section">
          <p>{t('terms.intro')}</p>
        </section>

        {SECTIONS.map(([titleKey, textKey]) => (
          <section className="legal-section" key={titleKey}>
            <h2 className="legal-section-title">{t(`terms.${titleKey}`)}</h2>
            <p>{t(`terms.${textKey}`)}</p>
          </section>
        ))}
      </main>
    </div>
  )
}

export default TermsPage
