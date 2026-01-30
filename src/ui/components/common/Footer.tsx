import './Footer.css'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="chronoline-footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-brand">
            <i className="fas fa-hourglass-start"></i>
            <span>ChronoLine</span>
          </div>
          <p className="footer-tagline">Visualize your journey through time</p>
        </div>

        <div className="footer-section">
          <h4>Navigation</h4>
          <ul className="footer-links">
            <li><a href="#timeline">Timeline</a></li>
            <li><a href="#events">Events</a></li>
            <li><a href="#settings">Settings</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Legal</h4>
          <ul className="footer-links">
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#terms">Terms of Service</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Connect</h4>
          <div className="social-links">
            <a href="#" title="GitHub"><i className="fab fa-github"></i></a>
            <a href="#" title="Twitter"><i className="fab fa-twitter"></i></a>
            <a href="#" title="Facebook"><i className="fab fa-facebook"></i></a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {currentYear} ChronoLine. All rights reserved.</p>
      </div>
    </footer>
  )
}
