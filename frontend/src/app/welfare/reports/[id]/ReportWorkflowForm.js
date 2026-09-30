'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportWorkflowForm({
  reportId,
  currentStatus,
  allowedNextStatuses = [],
  initialFollowUpOn = '',
}) {
  const router = useRouter();
  const [targetStatus, setTargetStatus] = useState(allowedNextStatuses[0] || '');
  const [followUpOn, setFollowUpOn] = useState(initialFollowUpOn || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (currentStatus === 'closed') {
    return (
      <div className="card" style={{ background: 'var(--bg-card-subtle)' }}>
        <h3 className="card-title">Case Closed</h3>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          This welfare report has been closed. Status transitions are final.
        </p>
      </div>
    );
  }

  if (allowedNextStatuses.length === 0) {
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const payload = {
        status: targetStatus,
      };

      if (targetStatus === 'follow_up' && followUpOn) {
        payload.followUpOn = followUpOn;
      }

      if (targetStatus === 'closed') {
        payload.notes = notes;
      }

      const res = await fetch(`/api/welfare/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update report status');
      }

      setSuccess(`Report updated to "${targetStatus.replace('_', ' ')}"`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const statusLabels = {
    acknowledged: 'Acknowledge Report',
    action_taken: 'Record Supportive Action',
    follow_up: 'Schedule Condition Follow-Up',
    closed: 'Close Case (Requires Outcome Notes)',
  };

  return (
    <div className="card" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-highlight)' }}>
      <h3 className="card-title">Welfare Workflow Transition</h3>
      <p className="card-desc">
        Record next steps for this unit. Only the assigned officer may advance this workflow.
      </p>

      {error && (
        <div className="alert-banner alert-warning" style={{ borderColor: 'var(--accent-red)', marginBottom: '1rem' }}>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="alert-banner alert-info" style={{ marginBottom: '1rem' }}>
          <div>{success}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="target-status">Select Next Status</label>
          <select
            id="target-status"
            className="form-input"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value)}
            disabled={submitting}
          >
            {allowedNextStatuses.map((st) => (
              <option key={st} value={st}>
                {statusLabels[st] || st}
              </option>
            ))}
          </select>
        </div>

        {targetStatus === 'follow_up' && (
          <div className="form-group">
            <label className="form-label" htmlFor="follow-up-date">Scheduled Review Date</label>
            <input
              id="follow-up-date"
              type="date"
              className="form-input"
              value={followUpOn}
              onChange={(e) => setFollowUpOn(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
        )}

        {targetStatus === 'closed' && (
          <div className="form-group">
            <label className="form-label" htmlFor="closure-notes">
              Documented Outcome Notes (min 10 characters)
            </label>
            <textarea
              id="closure-notes"
              className="form-input"
              rows={3}
              placeholder="e.g. Leave roster adjusted to resolve recovery gap; follow-up discussion held with unit commander."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              minLength={10}
              disabled={submitting}
              style={{ resize: 'vertical' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {notes.trim().length}/10 characters minimum
            </span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          style={{ width: 'auto', padding: '0.6rem 1.5rem', marginTop: '0.5rem' }}
          disabled={submitting || (targetStatus === 'closed' && notes.trim().length < 10)}
        >
          {submitting ? 'Saving...' : 'Apply Status Transition'}
        </button>
      </form>
    </div>
  );
}
