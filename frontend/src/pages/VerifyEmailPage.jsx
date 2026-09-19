import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'
import './AuthForm.css'

function VerifyEmailPage() {
  const { t } = useTranslation()
  usePageTitle(t('auth.verifyTitle'))
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  // 'loading' | 'success' | 'error'
  const [state, setState] = useState('loading')
  // Le jeton ne sert qu'une fois : on évite un double appel si l'effet est rejoué (StrictMode en dev).
  const calledRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }
    if (calledRef.current) return
    calledRef.current = true
    verifyEmail(token)
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [token])

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </header>

      <div className="auth-card">
        <h1 className="auth-logo">SHELVED</h1>
        <h2 className="auth-title">{t('auth.verifyTitle')}</h2>

        {state === 'loading' && <p className="auth-notice">…</p>}
        {state === 'success' && (
          <p className="auth-notice">{t('auth.verifySuccess')}</p>
        )}
        {state === 'error' && (
          <p className="auth-error">{t('auth.errors.invalid_or_expired_token')}</p>
        )}

        <Link to="/login" className="auth-link">
          {t('auth.backToLogin')}
        </Link>
      </div>
    </div>
  )
}

export default VerifyEmailPage
