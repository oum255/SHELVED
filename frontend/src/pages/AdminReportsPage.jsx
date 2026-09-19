import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getReports, updateReport } from '../api'
import { useAuth } from '../auth/AuthContext'
import NavBar from '../components/NavBar'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminReportsPage.css'

const STATUSES = ['pending', 'reviewed', 'removed']

function AdminReportsPage() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  usePageTitle(t('admin.reportsTitle'))

  const [statusFilter, setStatusFilter] = useState('pending')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.is_admin) return
    setLoading(true)
    getReports(token, statusFilter || undefined)
      .then(setReports)
      .finally(() => setLoading(false))
  }, [token, user, statusFilter])

  async function changeStatus(reportId, status) {
    const updated = await updateReport(token, reportId, status)
    // On enlève de la liste s'il ne correspond plus au filtre affiché.
    setReports((prev) =>
      statusFilter && updated.status !== statusFilter
        ? prev.filter((r) => r.id !== reportId)
        : prev.map((r) => (r.id === reportId ? updated : r))
    )
  }

  if (!user?.is_admin) {
    return (
      <div className="admin-reports">
        <NavBar />
        <main className="admin-reports-content">
          <p>{t('admin.notAdmin')}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-reports">
      <NavBar />
      <main className="admin-reports-content">
        <h1 className="admin-reports-title">{t('admin.reportsTitle')}</h1>

        <div className="admin-reports-filters">
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              className={statusFilter === s ? 'admin-filter active' : 'admin-filter'}
              onClick={() => setStatusFilter(s)}
            >
              {s ? t(`admin.status_${s}`) : t('admin.statusAll')}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">…</p>
        ) : reports.length === 0 ? (
          <p className="muted">{t('admin.noReports')}</p>
        ) : (
          <ul className="admin-report-list">
            {reports.map((r) => (
              <li key={r.id} className="admin-report-card">
                {r.image_url && (
                  <img className="admin-report-thumb" src={r.image_url} alt="" />
                )}
                <div className="admin-report-body">
                  <p className="admin-report-meta">
                    {t('admin.reportedBy', { username: r.reporter_username })}
                    {r.book_title ? ` · ${r.book_title}` : ''}
                  </p>
                  <p className="admin-report-reason">{r.reason}</p>
                  <span className={`admin-report-status status-${r.status}`}>
                    {t(`admin.status_${r.status}`)}
                  </span>
                </div>
                <div className="admin-report-actions">
                  {r.status !== 'reviewed' && (
                    <button
                      className="admin-action-btn"
                      onClick={() => changeStatus(r.id, 'reviewed')}
                    >
                      {t('admin.markReviewed')}
                    </button>
                  )}
                  {r.status !== 'removed' && (
                    <button
                      className="admin-action-btn admin-action-danger"
                      onClick={() => changeStatus(r.id, 'removed')}
                    >
                      {t('admin.removeContent')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

export default AdminReportsPage
