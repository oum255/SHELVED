import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'
import './AuthForm.css'

function LoginPage() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  usePageTitle(t('auth.loginTitle'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)

  // Redirigé ici après expiration de session : on l'affiche une fois puis on nettoie.
  useEffect(() => {
    if (sessionStorage.getItem('shelved_session_expired')) {
      setExpired(true)
      sessionStorage.removeItem('shelved_session_expired')
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
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
        <h2 className="auth-title">{t('auth.loginTitle')}</h2>

        {expired && <p className="auth-notice">{t('auth.sessionExpired')}</p>}

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
          {t('auth.passwordLabel')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="auth-error">{t(`auth.errors.${error}`)}</p>}

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? t('auth.loginLoading') : t('auth.loginButton')}
        </button>

        <Link to="/forgot-password" className="auth-link">
          {t('auth.forgotLink')}
        </Link>
        <Link to="/signup" className="auth-link">
          {t('auth.toSignup')}
        </Link>
      </form>
    </div>
  )
}

export default LoginPage
