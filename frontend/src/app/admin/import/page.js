import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../lib/commander/repository.js';
import ImportManager from './ImportManager.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Synthetic Dataset Ingestion — Unit Pulse 2.0 (Demo)',
  description: 'Restricted synthetic CSV import and schema validation for HR Uploaders.',
};

export default async function AdminImportPage() {
  let user = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      user = await fetchUserContext(supabase);
    } catch {
      user = null;
    }

    if (!user) {
      redirect('/login');
    }

    if (user.role !== 'hr_uploader' && user.role !== 'system_admin') {
      return (
        <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
          <div className="card" role="alert" style={{ border: '1px solid var(--accent-red)' }}>
            <h1 className="card-title" style={{ color: 'var(--accent-red)' }}>
              403 Forbidden — Unauthorized Role
            </h1>
            <p className="card-desc">
              The <code>/admin/import</code> flow is restricted strictly to the <strong>HR Uploader</strong> role.
              Your current session ({user.role}) does not have ingestion privileges.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <Link href="/login" className="btn btn-secondary">
                &larr; Switch Role / Sign In
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="section-title">Synthetic Dataset Ingestion</h1>
          <p className="section-subtitle">
            Restricted CSV import with RFC-4180 parsing, schema validation, relationship checks, and duplicate detection.
          </p>
        </div>
        <div>
          <Link href="/login" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Role Portal
          </Link>
        </div>
      </div>

      <ImportManager />
    </div>
  );
}
