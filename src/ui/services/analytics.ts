export interface AnalyticsSettings {
  enabled: boolean
  endpoint: string
  clientId: string
}

export interface AnalyticsEvent {
  id: string
  name: string
  timestamp: string
  sessionId: string
  clientId: string
  properties?: Record<string, unknown>
}

const SETTINGS_KEY = 'finance-analytics-settings'
const QUEUE_KEY = 'finance-analytics-queue'
const SESSION_ID = crypto.randomUUID()

const getEnvValue = (key: string) => {
  return (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key]
}

const DEFAULT_SETTINGS: AnalyticsSettings = {
  enabled: false,
  endpoint: getEnvValue('VITE_ANALYTICS_ENDPOINT') || '',
  clientId: ''
}

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const getAnalyticsSettings = (): AnalyticsSettings => {
  return safeParse<AnalyticsSettings>(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS)
}

export const updateAnalyticsSettings = (partial: Partial<AnalyticsSettings>) => {
  const current = getAnalyticsSettings()
  const next = {
    ...current,
    ...partial
  }
  if (!next.clientId) {
    next.clientId = crypto.randomUUID()
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

const getQueue = () => safeParse<AnalyticsEvent[]>(localStorage.getItem(QUEUE_KEY), [])

const setQueue = (queue: AnalyticsEvent[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export const initAnalytics = () => {
  updateAnalyticsSettings({})
  void flushQueue()
}

export const trackEvent = async (name: string, properties?: Record<string, unknown>) => {
  const settings = getAnalyticsSettings()
  if (!settings.enabled) return

  const event: AnalyticsEvent = {
    id: crypto.randomUUID(),
    name,
    timestamp: new Date().toISOString(),
    sessionId: SESSION_ID,
    clientId: settings.clientId,
    properties
  }

  const queue = getQueue()
  queue.push(event)
  setQueue(queue)
  await flushQueue()
}

export const flushQueue = async () => {
  const settings = getAnalyticsSettings()
  if (!settings.enabled || !settings.endpoint) return

  const queue = getQueue()
  if (queue.length === 0) return

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events: queue
      })
    })

    if (!response.ok) {
      return
    }

    setQueue([])
  } catch {
    // Keep queue for retry
  }
}
