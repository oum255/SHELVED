import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { resendVerification } from '../api'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import './NavBar.css'

// Liens principaux directement visibles ; le reste (compte, thème, langue, déconnexion) dans ☰.
function NavBar() {
  const { t } = useTranslation()
  const { user, token, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  // "idle" | "sending" | "sent"
  const [resendState, setResendState] = useState('idle')

  const close = () => setOpen(false)

  async function handleResend() {
    setResendState('sending')
    try {
      await resendVerification(token)
      setResendState('sent')
    } catch {
      setResendState('idle')
    }
  }

  return (
    <>
    {user && !user.email_verified && (
      <div className="navbar-verify-banner">
        {resendState === 'sent' ? (
          <span>{t('auth.verifyBannerSent')}</span>
        ) : (
          <>
            <span>{t('auth.verifyBannerText')}</span>
            <button
              type="button"
              className="navbar-verify-btn"
              onClick={handleResend}
              disabled={resendState === 'sending'}
            >
              {resendState === 'sending'
                ? t('auth.loginLoading')
                : t('auth.verifyBannerResend')}
            </button>
          </>
        )}
      </div>
    )}
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand" onClick={close}>SHELVED</NavLink>

      <div className="navbar-links">
        <NavLink to="/" end className="navbar-link">
          {t('nav.home')}
        </NavLink>
        <NavLink to="/library" end className="navbar-link">
          {t('nav.library')}
        </NavLink>
        {user && (
          <NavLink to="/feed" className="navbar-link">
            {t('nav.feed')}
          </NavLink>
        )}
        {user && (
          <NavLink to="/clubs" className="navbar-link">
            {t('nav.clubs')}
          </NavLink>
        )}
        {user && (
          <NavLink to="/stats" className="navbar-link">
            {t('nav.stats')}
          </NavLink>
        )}
      </div>

      <button
        type="button"
        className={open ? 'navbar-toggle open' : 'navbar-toggle'}
        aria-label={t('nav.menu')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && <div className="navbar-backdrop" onClick={close} />}

      <div className={open ? 'navbar-menu open' : 'navbar-menu'}>
        {user && (
          <NavLink to="/account" className="navbar-menu-link" onClick={close}>
            {t('nav.account')}
          </NavLink>
        )}
        {user && (
          <NavLink to="/settings" className="navbar-menu-link" onClick={close}>
            {t('nav.settings')}
          </NavLink>
        )}
        {user?.is_admin && (
          <NavLink to="/admin/reports" className="navbar-menu-link" onClick={close}>
            {t('nav.admin')}
          </NavLink>
        )}

        <div className="navbar-divider" />

        {/* Seulement pour les visiteurs non connectés : une fois connecté, thème
            et langue sont déjà dans "Réglages", pas besoin de les dupliquer. */}
        {!user && (
          <div className="navbar-switchers">
            <label className="navbar-field">
              <span className="navbar-field-label">{t('theme.label')}</span>
              <ThemeSwitcher />
            </label>
            <label className="navbar-field">
              <span className="navbar-field-label">{t('language.label')}</span>
              <LanguageSwitcher />
            </label>
          </div>
        )}

        {user ? (
          <button
            className="navbar-logout"
            onClick={() => {
              close()
              signOut()
            }}
          >
            {t('home.logout')}
          </button>
        ) : (
          <NavLink to="/login" className="navbar-login" onClick={close}>
            {t('nav.login')}
          </NavLink>
        )}
      </div>
    </nav>
    </>
  )
}

export default NavBar
