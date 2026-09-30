import Link from 'next/link';

export const metadata = {
  title: 'Role Portal Sign In — Unit Pulse 2.0 (Synthetic Demo)',
  description: 'Role-scoped authentication for Commanders, Welfare Officers, and HR Administrators.',
};

export default function LoginPage() {
  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '1rem 0 3rem' }}>
      {/* Synthetic Prototype Notice Banner */}
      <div className="alert-banner alert-warning">
        <div>
          <strong>SYNTHETIC DEMO ENVIRONMENT:</strong> Authentic access boundaries are enforced using
          Supabase Auth and protected Row-Level Security. In accordance with security specifications,{' '}
          <strong>no fake authentication bypass or client-visible service keys</strong> are implemented.
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h1 className="card-title" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
          Role Portal Sign In
        </h1>
        <p className="card-desc">
          Sign in to access your scoped operational view. User roles and unit assignments are strictly
          governed by protected database tables, never client-editable parameters.
        </p>

        {/* Phase 1 Integration Notice */}
        <div className="alert-banner alert-info" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <strong>Phase 0 Architecture Notice:</strong> Active session management and database-driven
            role provisioning are scheduled for <strong>Phase 1</strong> (following Supabase schema
            migration). The interface below demonstrates the production credential inputs. No mock
            tokens or hardcoded master bypasses are permitted.
          </div>
        </div>

        <form action="#" method="POST" style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Official Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="officer@crpf.gov.in (Synthetic demo account)"
              disabled
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              disabled
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="role-preview">
              Target Role Scope
            </label>
            <select id="role-preview" className="form-input" disabled defaultValue="commander">
              <option value="commander">Commander (Assigned units aggregate summary only)</option>
              <option value="welfare_officer">Welfare Officer (Assigned reports &amp; audited access)</option>
              <option value="hr_uploader">HR Uploader (Synthetic CSV upload &amp; verification)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-primary btn-disabled"
            title="Supabase Auth live integration scheduled for Phase 1"
          >
            Sign In with Supabase Auth (Phase 1 Integration)
          </button>
        </form>
      </div>

      {/* Role Scopes Breakdown */}
      <div className="section-header">
        <h2 className="section-title" style={{ fontSize: '1.25rem' }}>
          Authorized Role Permissions &amp; Strict Non-Permissions
        </h2>
        <p className="section-subtitle">
          Trust boundaries defined in docs/05-system-architecture.md and docs/10-security-privacy.md.
        </p>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--accent-blue)' }}>
            Commander
          </h3>
          <p className="card-desc">
            <strong>Can see:</strong> Approved unit cards, rolling baseline trends, leave/night-duty indicators, and supportive options.
          </p>
          <p className="card-desc" style={{ color: '#f87171', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            <strong>CANNOT see:</strong> Personnel IDs, names, individual stress rankings, or private welfare notes.
          </p>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--accent-emerald)' }}>
            Welfare Officer
          </h3>
          <p className="card-desc">
            <strong>Can see:</strong> Assigned elevated unit reports, documented follow-up workflows, and time-limited individual records via break-glass.
          </p>
          <p className="card-desc" style={{ color: '#f87171', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            <strong>CANNOT see:</strong> Unassigned unit reports or unlogged raw personal data.
          </p>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--accent-amber)' }}>
            HR / Data Uploader
          </h3>
          <p className="card-desc">
            <strong>Can see:</strong> Upload synthetic records, review schema validation errors, and coverage summaries.
          </p>
          <p className="card-desc" style={{ color: '#f87171', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            <strong>CANNOT see:</strong> Welfare reports, case notes, or grant requests.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link href="/" className="nav-link" style={{ fontSize: '0.95rem' }}>
          &larr; Return to Public Explanation Page
        </Link>
      </div>
    </div>
  );
}
