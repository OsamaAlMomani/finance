import { useState, useMemo } from 'react'
import { useCalendarEvents } from '../../hooks/useFinanceData'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import '../../styles/EnhancedCalendar.css'

export default function EnhancedCalendar() {
  const { calendarEvents, loading, error, addCalendarEvent, deleteCalendarEvent } = useCalendarEvents()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [view, setView] = useState<'month' | 'week' | 'list'>('month')

  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    type: 'expense' as const,
    recurring: 'once' as const
  })

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const handleAddEvent = async (e: React.FormEvent, dateStr: string) => {
    e.preventDefault()
    if (!formData.description) return

    try {
      await addCalendarEvent({
        date: dateStr,
        description: formData.description,
        amount: formData.amount,
        type: formData.type,
        recurring: formData.recurring
      })
      setFormData({ description: '', amount: 0, type: 'expense', recurring: 'once' })
      setSelectedDate(null)
      setShowForm(false)
    } catch (err) {
      console.error('Error adding event:', err)
    }
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return calendarEvents.filter(event => event.date.startsWith(dateStr))
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const calendarDays = []

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  const getDateObject = (day: number) => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
  }

  const isToday = (day: number) => {
    const today = new Date()
    const date = getDateObject(day)
    return date.toDateString() === today.toDateString()
  }

  const upcomingEvents = useMemo(() => {
    const today = new Date()
    return calendarEvents
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
  }, [calendarEvents])

  const monthlyTotalIncome = useMemo(() => {
    return calendarEvents
      .filter(event => {
        const eventDate = new Date(event.date)
        return eventDate.getMonth() === currentMonth.getMonth() &&
               eventDate.getFullYear() === currentMonth.getFullYear() &&
               event.type === 'income'
      })
      .reduce((sum, event) => sum + event.amount, 0)
  }, [calendarEvents, currentMonth])

  const monthlyTotalExpense = useMemo(() => {
    return calendarEvents
      .filter(event => {
        const eventDate = new Date(event.date)
        return eventDate.getMonth() === currentMonth.getMonth() &&
               eventDate.getFullYear() === currentMonth.getFullYear() &&
               event.type === 'expense'
      })
      .reduce((sum, event) => sum + event.amount, 0)
  }, [calendarEvents, currentMonth])

  if (loading) return <div className="calendar-container"><p>Loading calendar...</p></div>
  if (error) return <div className="calendar-container"><p className="error">Error: {error}</p></div>

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>📅 Smart Calendar Planner</h2>
        <div className="view-controls">
          <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Month</button>
          <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Week</button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {view === 'month' && (
        <>
          <div className="calendar-navigation">
            <button onClick={handlePrevMonth} className="nav-btn">
              <ChevronLeft size={20} />
            </button>
            <h3>{months[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <button onClick={handleNextMonth} className="nav-btn">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="calendar-months-summary">
            <div className="summary-card income">
              <span>Income</span>
              <strong>${monthlyTotalIncome.toLocaleString()}</strong>
            </div>
            <div className="summary-card expense">
              <span>Expenses</span>
              <strong>${monthlyTotalExpense.toLocaleString()}</strong>
            </div>
            <div className="summary-card net">
              <span>Net</span>
              <strong>${(monthlyTotalIncome - monthlyTotalExpense).toLocaleString()}</strong>
            </div>
          </div>

          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {days.map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="calendar-days">
              {calendarDays.map((day, idx) => {
                const dateStr = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0] : null
                const dayEvents = day ? getEventsForDate(getDateObject(day)) : []
                const isCurrentDay = day && isToday(day)

                return (
                  <div
                    key={idx}
                    className={`calendar-day ${!day ? 'empty' : ''} ${isCurrentDay ? 'today' : ''}`}
                    onClick={() => {
                      if (day) {
                        setSelectedDate(dateStr)
                        setShowForm(true)
                      }
                    }}
                  >
                    {day && (
                      <>
                        <div className="day-number">{day}</div>
                        <div className="day-events">
                          {dayEvents.slice(0, 2).map(event => (
                            <div
                              key={event.id}
                              className={`event-dot ${event.type}`}
                              title={event.description}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                            >
                              <span className="event-indicator">•</span>
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="event-overflow">+{dayEvents.length - 2}</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {view === 'list' && (
        <div className="calendar-list-view">
          <div className="upcoming-events">
            <h3>📌 Upcoming Events</h3>
            {upcomingEvents.length === 0 ? (
              <div className="empty-state">No upcoming events</div>
            ) : (
              upcomingEvents.map(event => (
                <div key={event.id} className={`event-list-item ${event.type}`}>
                  <div className="event-date">
                    {new Date(event.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="event-details">
                    <div className="event-description">{event.description}</div>
                    <div className="event-meta">
                      <span className="type">{event.type === 'income' ? '➕' : '➖'} ${event.amount.toLocaleString()}</span>
                      {event.recurring !== 'once' && <span className="recurring">{event.recurring}</span>}
                    </div>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => deleteCalendarEvent(event.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedDate && showForm && (
        <div className="calendar-form-modal">
          <div className="form-overlay" onClick={() => setShowForm(false)} />
          <div className="form-content">
            <h4>Add Event for {new Date(selectedDate).toLocaleDateString()}</h4>
            <form onSubmit={(e) => handleAddEvent(e, selectedDate)}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Event description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <select
                  value={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.value as any })}
                >
                  <option value="once">Once</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">Save Event</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDate && !showForm && (
        <div className="calendar-form-modal">
          <div className="form-overlay" onClick={() => setSelectedDate(null)} />
          <div className="form-content">
            <h4>Events for {new Date(selectedDate).toLocaleDateString()}</h4>
            {getEventsForDate(new Date(selectedDate + 'T00:00:00')).length === 0 ? (
              <p>No events scheduled</p>
            ) : (
              <div className="events-list">
                {getEventsForDate(new Date(selectedDate + 'T00:00:00')).map(event => (
                  <div key={event.id} className="event-item">
                    <div>{event.description}</div>
                    <div>{event.type === 'income' ? '➕' : '➖'} ${event.amount.toLocaleString()}</div>
                    <button
                      className="btn-delete"
                      onClick={() => deleteCalendarEvent(event.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={16} /> Add Event
              </button>
              <button className="btn-secondary" onClick={() => setSelectedDate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
