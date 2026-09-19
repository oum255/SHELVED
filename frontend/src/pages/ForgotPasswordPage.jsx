import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'
import './AuthForm.css'

function ForgotPasswordPage() {
  const { t } = useTranslation()
  usePageTitle(t('auth.forgotTitle'))
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
    } finally {
      // Même message dans tous les cas : le backend répond pareil, pour ne pas révéler si l'email existe.
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </header>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-logo">SHELVED</h1>
        <h2 className="auth-title">{t('auth.forgotTitle')}</h2>

        {sent ? (
          <p className="auth-notice">{t('auth.forgotSent')}</p>
        ) : (
          <>
            <p className="auth-notice">{t('auth.forgotHint')}</p>
            <label className="auth-field">
              {t('auth.emailLabel')}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? t('auth.loginLoading') : t('auth.forgotButton')}
            </button>
          </>
        )}

        <Link to="/login" className="auth-link">
          {t('auth.backToLogin')}
        </Link>
      </form>
    </div>
  )
}

export default ForgotPasswordPage
