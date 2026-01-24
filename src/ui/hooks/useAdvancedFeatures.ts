import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

// Get the electron ipcRenderer from window.electron (exposed by preload script)
const ipc = (window as any).electron?.ipcRenderer

if (!ipc) {
  console.warn('Electron IPC not available')
}

// ============ TODO INTERFACES ============

export interface TodoItem {
  id: string
  title: string
  description?: string
  dueDate: string
  dueTime?: string
  priority: 'low' | 'medium' | 'high'
  completed: boolean
  category: string
  estimatedHours?: number
  actualHours?: number
  subtasks?: TodoSubtask[]
  createdAt: string
  updatedAt: string
}

export interface TodoSubtask {
  id: string
  title: string
  completed: boolean
}

// ============ TODO HOOKS ============

export function useTodos() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-todos')
      setTodos(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch todos')
    } finally {
      setLoading(false)
    }
  }

  const addTodo = async (todo: Omit<TodoItem, 'id' | 'completed' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTodo = await ipc?.invoke('add-todo', { ...todo, completed: false })
      setTodos(prev => [...prev, newTodo])
      return newTodo
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add todo')
    }
  }

  const updateTodo = async (id: string, updates: Partial<TodoItem>) => {
    try {
      await ipc?.invoke('update-todo', id, updates)
      setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update todo')
    }
  }

  const deleteTodo = async (id: string) => {
    try {
      await ipc?.invoke('delete-todo', id)
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete todo')
    }
  }

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (todo) {
      await updateTodo(id, { completed: !todo.completed })
    }
  }

  const addSubtask = async (todoId: string, subtask: Omit<TodoSubtask, 'id'>) => {
    try {
      const todo = todos.find(t => t.id === todoId)
      if (todo) {
        const newSubtask = { id: uuidv4(), ...subtask }
        const updated = {
          subtasks: [...(todo.subtasks || []), newSubtask]
        }
        await updateTodo(todoId, updated)
        return newSubtask
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add subtask')
    }
  }

  const toggleSubtask = async (todoId: string, subtaskId: string) => {
    const todo = todos.find(t => t.id === todoId)
    if (todo && todo.subtasks) {
      const updated = {
        subtasks: todo.subtasks.map(s => 
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        )
      }
      await updateTodo(todoId, updated)
    }
  }

  useEffect(() => {
    fetchTodos()
    const unsubscribe = ipc?.on('todos-updated', () => {
      fetchTodos()
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  return { todos, loading, error, addTodo, updateTodo, deleteTodo, toggleTodo, addSubtask, toggleSubtask, refetch: fetchTodos }
}

// ============ DASHBOARD CUSTOMIZATION HOOKS ============

export interface DashboardConfig {
  id: string
  toolIds: string[] // Ordered list of enabled tool IDs
  toolSettings: Record<string, { visible: boolean; pinned?: boolean; customSettings?: any }>
  theme?: string
  layout?: 'grid' | 'list'
  updatedAt: string
}

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-dashboard-config')
      setConfig(data)
    } catch (err) {
      console.error('Failed to fetch dashboard config:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (newConfig: Partial<DashboardConfig>) => {
    try {
      const saved = await ipc?.invoke('save-dashboard-config', newConfig)
      setConfig(saved)
      return saved
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to save dashboard config')
    }
  }

  const toggleTool = async (toolId: string, visible: boolean) => {
    if (config) {
      const updated = {
        ...config,
        toolSettings: {
          ...config.toolSettings,
          [toolId]: {
            ...config.toolSettings[toolId],
            visible
          }
        },
        toolIds: visible
          ? [...config.toolIds, toolId]
          : config.toolIds.filter(id => id !== toolId)
      }
      await saveConfig(updated)
    }
  }

  const reorderTools = async (toolIds: string[]) => {
    if (config) {
      await saveConfig({ toolIds })
    }
  }

  const pinTool = async (toolId: string, pinned: boolean) => {
    if (config) {
      const updated = {
        ...config,
        toolSettings: {
          ...config.toolSettings,
          [toolId]: {
            ...config.toolSettings[toolId],
            pinned
          }
        }
      }
      await saveConfig(updated)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  return { config, loading, saveConfig, toggleTool, reorderTools, pinTool }
}

// ============ ADVANCED ANALYTICS HOOKS ============

export interface AnalyticsData {
  id: string
  date: string
  metric: string
  value: number
  category?: string
}

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = async (metricType?: string, dateRange?: { start: string; end: string }) => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-analytics', metricType, dateRange)
      setAnalytics(data || [])
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const addAnalyticsData = async (metric: AnalyticsData) => {
    try {
      const newData = await ipc?.invoke('add-analytics', metric)
      setAnalytics(prev => [...prev, newData])
      return newData
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add analytics data')
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  return { analytics, loading, fetchAnalytics, addAnalyticsData }
}

// ============ ALERTS & NOTIFICATIONS ============

export interface Alert {
  id: string
  type: 'warning' | 'alert' | 'info' | 'success'
  title: string
  message: string
  threshold?: number
  metric?: string
  active: boolean
  createdAt: string
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-alerts')
      setAlerts(data || [])
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const createAlert = async (alert: Omit<Alert, 'id' | 'createdAt'>) => {
    try {
      const newAlert = await ipc?.invoke('create-alert', alert)
      setAlerts(prev => [...prev, newAlert])
      return newAlert
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create alert')
    }
  }

  const updateAlert = async (id: string, updates: Partial<Alert>) => {
    try {
      await ipc?.invoke('update-alert', id, updates)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update alert')
    }
  }

  const deleteAlert = async (id: string) => {
    try {
      await ipc?.invoke('delete-alert', id)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete alert')
    }
  }

  useEffect(() => {
    fetchAlerts()
    const unsubscribe = ipc?.on('alerts-updated', () => {
      fetchAlerts()
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  return { alerts, loading, createAlert, updateAlert, deleteAlert, refetch: fetchAlerts }
}
