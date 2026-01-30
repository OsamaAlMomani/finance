import ThemeSelector from './ThemeSelector'
import './Header.css'

export default function Header() {
  return (
    <header className="chronoline-header">
      <div className="header-container">
        <div className="logo-section">
          <div className="logo-icon">
            <i className="fas fa-timeline"></i>
          </div>
          <div className="logo-text">
            <h1>ChronoLine</h1>
            <p>Visualize your journey through time</p>
          </div>
        </div>

        <div className="header-controls">
          <ThemeSelector />
          <button
            className="btn-add-event-header"
            onClick={() => {
              const event = new CustomEvent('openAddEventModal')
              window.dispatchEvent(event)
            }}
          >
            <i className="fas fa-plus"></i>
            <span>Add Event</span>
          </button>
        </div>
      </div>
    </header>
  )
}
