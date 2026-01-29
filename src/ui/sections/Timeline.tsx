import '../styles/Transactions.css'

/**
 * Timeline - The one truth ledger
 * Shows all transactions + scheduled events (bills, goals, etc.)
 * This is the central view where everything connects
 */
export default function Timeline() {
  return (
    <div className="section-container">
      <div className="section-header">
        <h1>Timeline</h1>
        <p>Your complete financial history and scheduled events</p>
      </div>

      <div className="timeline-content">
        <div className="info-message">
          <h3>📊 Timeline - The One Truth Ledger</h3>
          <p>This will show all your transactions + scheduled bills, goals, and events in one unified view.</p>
          <p>Everything connects here:</p>
          <ul>
            <li>✓ Past transactions</li>
            <li>✓ Scheduled bills (from Plan)</li>
            <li>✓ Goal contributions (from Plan)</li>
            <li>✓ Future forecasts</li>
          </ul>
          <p><strong>Click any chart in Insights</strong> to filter the timeline to that specific data.</p>
        </div>
      </div>
    </div>
  )
}
