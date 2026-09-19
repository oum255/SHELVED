import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import NavBar from '../components/NavBar'
import ThemeSwitcher from '../components/ThemeSwitcher'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'
import './SettingsPage.css'

const USERNAME_COOLDOWN_DAYS = 30

// Réglages séparés de "Mon compte" : identifiants, sécurité, zone dangereuse.
function SettingsPage() {
  const { t } = useTranslation()
  const { user, deleteAccount, changeUsername, changeEmail, changePassword } = useAuth()
  const navigate = useNavigate()
  usePageTitle(t('settings.title'))

  // --- Changer de pseudo (protégé par le mot de passe, 1 fois / 30 jours) ---
  const [showUsernameForm, setShowUsernameForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernamePassword, setUsernamePassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)

  const nextUsernameChangeDate = user?.username_changed_at
    ? new Date(
        new Date(user.username_changed_at).getTime() +
          USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      )
    : null
  const canChangeUsername = !nextUsernameChangeDate || nextUsernameChangeDate <= new Date()

  async function handleChangeUsername(event) {
    event.preventDefault()
    setUsernameError('')
    setUsernameSaving(true)
    try {
      await changeUsername(newUsername.trim(), usernamePassword)
      setShowUsernameForm(false)
      setUsernamePassword('')
      setNewUsername('')
    } catch (err) {
      setUsernameError(err.message)
    } finally {
      setUsernameSaving(false)
    }
  }

  // --- Changer d'email (protégé par le mot de passe) ---
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailChanged, setEmailChanged] = useState(false)

  async function handleChangeEmail(event) {
    event.preventDefault()
    setEmailError('')
    setEmailSaving(true)
    try {
      await changeEmail(newEmail.trim(), emailPassword)
      setShowEmailForm(false)
      setEmailPassword('')
      setNewEmail('')
      setEmailChanged(true)
    } catch (err) {
      setEmailError(err.message)
    } finally {
      setEmailSaving(false)
    }
  }

  // --- Changer de mot de passe (protégé par le mot de passe actuel) ---
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPasswordInput, setCurrentPasswordInput] = useState('')
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)

  async function handleChangePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSaving(true)
    try {
      await changePassword(currentPasswordInput, newPasswordInput)
      setShowPasswordForm(false)
      setCurrentPasswordInput('')
      setNewPasswordInput('')
      setPasswordChanged(true)
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  // --- Suppression du compte ---
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const canDelete = user && typed.trim() === user.username

  async function handleDelete() {
    if (!canDelete) return
    setDeleteError('')
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/')
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  return (
    <div className="settings">
      <NavBar />
      <main className="settings-content">
        <h1 className="settings-title">{t('settings.title')}</h1>

        {/* Aussi accessible depuis le menu ☰ pour les visiteurs non connectés */}
        <section className="settings-section">
          <h2 className="settings-section-title">{t('settings.preferencesTitle')}</h2>

          <div className="settings-row">
            <span className="settings-label">{t('theme.label')}</span>
            <ThemeSwitcher />
          </div>
          <div className="settings-row">
            <span className="settings-label">{t('language.label')}</span>
            <LanguageSwitcher />
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{t('account.credentialsTitle')}</h2>

          <div className="settings-row">
            <div>
              <span className="settings-label">{t('account.usernameLabel')}</span>
              <span>{user?.username}</span>
            </div>
            {canChangeUsername ? (
              <button
                type="button"
                className="settings-link-btn"
                onClick={() => setShowUsernameForm((v) => !v)}
              >
                {t('account.change')}
              </button>
            ) : (
              <span className="settings-cooldown-notice">
                {t('account.usernameCooldown', {
                  date: nextUsernameChangeDate.toLocaleDateString(),
                })}
              </span>
            )}
          </div>
          {showUsernameForm && (
            <form onSubmit={handleChangeUsername} className="settings-inline-form">
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={t('account.newUsernamePlaceholder')}
                aria-label={t('account.newUsernamePlaceholder')}
                minLength={3}
                maxLength={30}
                required
              />
              <input
                type="password"
                value={usernamePassword}
                onChange={(e) => setUsernamePassword(e.target.value)}
                placeholder={t('account.currentPasswordPlaceholder')}
                aria-label={t('account.currentPasswordPlaceholder')}
                required
              />
              {usernameError && (
                <p className="settings-error">{t(`account.errors.${usernameError}`)}</p>
              )}
              <button type="submit" className="settings-save-btn" disabled={usernameSaving}>
                {usernameSaving ? t('account.saving') : t('account.save')}
              </button>
            </form>
          )}

          <div className="settings-row">
            <div>
              <span className="settings-label">{t('account.emailLabel')}</span>
              <span>{user?.email}</span>
              {user && !user.email_verified && (
                <span className="settings-unverified-tag">{t('account.unverifiedTag')}</span>
              )}
            </div>
            <button
              type="button"
              className="settings-link-btn"
              onClick={() => setShowEmailForm((v) => !v)}
            >
              {t('account.change')}
            </button>
          </div>
          {showEmailForm && (
            <form onSubmit={handleChangeEmail} className="settings-inline-form">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t('account.newEmailPlaceholder')}
                aria-label={t('account.newEmailPlaceholder')}
                required
              />
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder={t('account.currentPasswordPlaceholder')}
                aria-label={t('account.currentPasswordPlaceholder')}
                required
              />
              {emailError && <p className="settings-error">{t(`account.errors.${emailError}`)}</p>}
              <button type="submit" className="settings-save-btn" disabled={emailSaving}>
                {emailSaving ? t('account.saving') : t('account.save')}
              </button>
            </form>
          )}
          {emailChanged && <p className="settings-saved-notice">{t('account.emailChangedNotice')}</p>}
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{t('account.securityTitle')}</h2>

          <div className="settings-row">
            <div>
              <span className="settings-label">{t('auth.newPasswordLabel')}</span>
              <span>••••••••</span>
            </div>
            <button
              type="button"
              className="settings-link-btn"
              onClick={() => setShowPasswordForm((v) => !v)}
            >
              {t('account.change')}
            </button>
          </div>
          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="settings-inline-form">
              <input
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder={t('account.currentPasswordPlaceholder')}
                aria-label={t('account.currentPasswordPlaceholder')}
                required
              />
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder={t('auth.newPasswordLabel')}
                aria-label={t('auth.newPasswordLabel')}
                minLength={8}
                required
              />
              {passwordError && (
                <p className="settings-error">{t(`account.errors.${passwordError}`)}</p>
              )}
              <button type="submit" className="settings-save-btn" disabled={passwordSaving}>
                {passwordSaving ? t('account.saving') : t('account.save')}
              </button>
            </form>
          )}
          {passwordChanged && <p className="settings-saved-notice">{t('account.passwordChanged')}</p>}
        </section>

        <div className="settings-links">
          <Link to="/privacy" className="settings-link">{t('account.privacy')}</Link>
          <Link to="/terms" className="settings-link">{t('account.terms')}</Link>
        </div>

        <section className="settings-danger">
          <h2 className="settings-danger-title">{t('account.dangerTitle')}</h2>
          <p className="settings-danger-text">{t('account.deleteWarning')}</p>

          {!confirming ? (
            <button
              className="settings-delete-btn"
              onClick={() => setConfirming(true)}
            >
              {t('account.deleteButton')}
            </button>
          ) : (
            <div className="settings-confirm">
              <label className="settings-confirm-prompt" htmlFor="settings-delete-confirm-input">
                {t('account.confirmPrompt', { username: user?.username })}
              </label>
              <input
                id="settings-delete-confirm-input"
                className="settings-confirm-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={user?.username}
                autoFocus
              />
              {deleteError && <p className="settings-error">{t(`account.errors.${deleteError}`)}</p>}
              <div className="settings-confirm-actions">
                <button
                  className="settings-cancel-btn"
                  onClick={() => {
                    setConfirming(false)
                    setTyped('')
                    setDeleteError('')
                  }}
                  disabled={deleting}
                >
                  {t('account.cancel')}
                </button>
                <button
                  className="settings-delete-btn"
                  onClick={handleDelete}
                  disabled={!canDelete || deleting}
                >
                  {deleting ? t('account.deleting') : t('account.confirmDelete')}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default SettingsPage
