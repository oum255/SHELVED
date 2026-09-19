import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { signup } from '../api'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'
import './AuthForm.css'

function SignupPage() {
  const { t, i18n } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  usePageTitle(t('auth.signupTitle'))

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('') // clé d'erreur à traduire
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      // La langue de l'interface est envoyée pour les emails (vérification, etc.) dans la bonne langue.
      await signup({ email, username, password, language: i18n.resolvedLanguage })
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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
        <h2 className="auth-title">{t('auth.signupTitle')}</h2>

        <label className="auth-field">
          {t('auth.emailLabel')}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="auth-field">
          {t('auth.usernameLabel')}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
          />
        </label>

        <label className="auth-field">
          {t('auth.passwordLabel')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <span className="auth-hint">{t('auth.passwordHint')}</span>
        </label>

        {error && <p className="auth-error">{t(`auth.errors.${error}`)}</p>}

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? t('auth.signupLoading') : t('auth.signupButton')}
        </button>

        <p className="auth-consent" style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center', margin: '0.2rem 0' }}>
          {t('auth.consent')}{' '}
          <Link to="/privacy" className="auth-link">{t('account.privacy')}</Link>
          {' · '}
          <Link to="/terms" className="auth-link">{t('account.terms')}</Link>
        </p>

        <Link to="/login" className="auth-link">
          {t('auth.toLogin')}
        </Link>
      </form>
    </div>
  )
}

export default SignupPage
