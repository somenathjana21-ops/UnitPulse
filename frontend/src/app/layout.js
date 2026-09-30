import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Unit Pulse 2.0 — Privacy-First Aggregate Welfare Intelligence (Synthetic Demo)',
  description:
    'Operational welfare planning and confidential escalation prototype using synthetic data. Not a medical diagnosis.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="nav-container">
            <div className="brand-group">
              <Link href="/" className="brand-title">
                Unit Pulse 2.0
              </Link>
              <span className="badge-synthetic">Synthetic Demo</span>
            </div>
            <nav>
              <ul className="nav-links">
                <li>
                  <Link href="/" className="nav-link">
                    Overview
                  </Link>
                </li>
                <li>
                  <a href="#how-it-works" className="nav-link">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#roadmap" className="nav-link">
                    Roadmap &amp; TODOs
                  </a>
                </li>
                <li>
                  <Link href="/login" className="nav-btn">
                    Role Portal Login
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="main-content">{children}</main>

        <footer className="site-footer">
          <div className="footer-container">
            <div className="safety-box">
              <strong>MANDATORY SAFETY STATEMENT:</strong> The Unit Load &amp; Recovery Index is an
              operational welfare planning indicator. It is <strong>NOT</strong> a medical diagnosis and
              must never be used as evidence of individual psychological fitness, misconduct, or
              eligibility for promotion or deployment. All figures, personnel records, and units in this
              prototype are <strong>fictional synthetic demo data</strong>.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                Unit Pulse 2.0 &bull; SIH Problem Statement 26186 &bull; MedTech / BioTech / HealthTech
              </div>
              <div>
                Architecture: Next.js App Router (JS) &bull; Server-only Backend &bull; Deterministic ML
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
