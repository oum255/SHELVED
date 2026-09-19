import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'
import './AuthForm.css'

function ResetPasswordPage() {
  const { t } = useTranslation()
  usePageTitle(t('auth.resetTitle'))
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
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
        <h2 className="auth-title">{t('auth.resetTitle')}</h2>

        {!token ? (
          <p className="auth-error">{t('auth.errors.invalid_or_expired_token')}</p>
        ) : done ? (
          <p className="auth-notice">{t('auth.resetDone')}</p>
        ) : (
          <>
            <label className="auth-field">
              {t('auth.newPasswordLabel')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            {error && <p className="auth-error">{t(`auth.errors.${error}`)}</p>}

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? t('auth.loginLoading') : t('auth.resetButton')}
            </button>
          </>
        )}

        {done && (
          <button
            type="button"
            className="auth-button"
            onClick={() => navigate('/login')}
          >
            {t('auth.backToLogin')}
          </button>
        )}
        {!done && (
          <Link to="/login" className="auth-link">
            {t('auth.backToLogin')}
          </Link>
        )}
      </form>
    </div>
  )
}

export default ResetPasswordPage
