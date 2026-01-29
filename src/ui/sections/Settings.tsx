import { useEffect, useState } from 'react'
import { getAnalyticsSettings, updateAnalyticsSettings, trackEvent } from '../services/analytics'
import '../styles/Settings.css'

export default function Settings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
  const [endpoint, setEndpoint] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const settings = getAnalyticsSettings()
    setAnalyticsEnabled(settings.enabled)
    setEndpoint(settings.endpoint)
    setClientId(settings.clientId)
  }, [])

  const handleSave = () => {
    const next = updateAnalyticsSettings({
      enabled: analyticsEnabled,
      endpoint: endpoint.trim()
    })
    setClientId(next.clientId)
    setStatus('Settings saved.')
    setTimeout(() => setStatus(null), 2000)
  }

  const handleTest = async () => {
    setStatus('Sending test event...')
    await trackEvent('analytics_test', { source: 'settings' })
    setStatus('Test event queued/sent.')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="section-page settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage privacy and analytics preferences.</p>
      </header>

      <section className="settings-card">
        <div className="settings-row">
          <div>
            <h2>Anonymous Analytics (Opt-in)</h2>
            <p>
              Help improve the app by sharing anonymous usage events like feature opens and page views.
              No transaction details or personal data are included.
            </p>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(event) => setAnalyticsEnabled(event.target.checked)}
            />
            <span>Enable</span>
          </label>
        </div>

        <div className="settings-field">
          <label htmlFor="analytics-endpoint">Analytics Endpoint URL</label>
          <input
            id="analytics-endpoint"
            type="text"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="https://your-domain.com/analytics"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="analytics-client-id">Anonymous Client ID</label>
          <input
            id="analytics-client-id"
            type="text"
            value={clientId}
            readOnly
          />
        </div>

        <div className="settings-actions">
          <button className="settings-btn secondary" onClick={handleSave}>Save</button>
          <button
            className="settings-btn primary"
            onClick={handleTest}
            disabled={!analyticsEnabled || !endpoint.trim()}
          >
            Send Test Event
          </button>
        </div>

        {status && <div className="settings-status">{status}</div>}
      </section>
    </div>
  )
}
