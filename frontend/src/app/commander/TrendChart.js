/**
 * frontend/src/app/commander/TrendChart.js
 *
 * Accessible weekly index-vs-baseline trend chart. No client JS: a plain
 * inline SVG (decorative, aria-hidden) plus a real HTML table carrying the
 * same values is the primary accessible representation, per docs/04's
 * "accessible trend visualization" and "text alternatives for chart colors"
 * requirement, and the dataviz skill's guidance to keep the actually
 * operable content in plain HTML rather than relying on SVG hover alone.
 *
 * Identity is never color-alone: the index line is solid, the baseline
 * line is dashed, and both are direct-labeled in a text legend.
 */

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 32 };
const PLOT_W = WIDTH - PADDING.left - PADDING.right;
const PLOT_H = HEIGHT - PADDING.top - PADDING.bottom;
const MAX_Y = 100; // index/baseline are always 0-100

function xFor(i, count) {
  if (count <= 1) return PADDING.left + PLOT_W / 2;
  return PADDING.left + (i / (count - 1)) * PLOT_W;
}

function yFor(value) {
  return PADDING.top + PLOT_H - (value / MAX_Y) * PLOT_H;
}

// Splits points into contiguous runs of non-null values so the line never
// bridges across a withheld/suppressed week.
function buildSegments(points, key) {
  const segments = [];
  let current = [];
  points.forEach((point, i) => {
    const value = point[key];
    if (value === null || value === undefined) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ i, value });
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

function shortWeekLabel(weekStart) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * @param {Object} props
 * @param {Array<{weekStart: string, index: number|null, baseline: number|null}>} props.points
 * @param {boolean} props.hasWithheldWeeks
 */
export default function TrendChart({ points, hasWithheldWeeks }) {
  if (!points || points.length === 0) {
    return <p className="card-desc">No weekly history yet.</p>;
  }

  const count = points.length;
  const indexSegments = buildSegments(points, 'index');
  const baselineSegments = buildSegments(points, 'baseline');
  const latest = [...points].reverse().find((p) => p.index !== null);
  const nonNullIndices = points.filter((p) => p.index !== null).map((p) => p.index);
  const minIndex = nonNullIndices.length > 0 ? Math.min(...nonNullIndices) : null;
  const maxIndex = nonNullIndices.length > 0 ? Math.max(...nonNullIndices) : null;
  const firstIndex = nonNullIndices.length > 0 ? nonNullIndices[0] : null;

  let trendTrajectory = 'stable';
  if (latest && firstIndex !== null) {
    if (latest.index >= firstIndex + 8) trendTrajectory = 'elevating (increasing load)';
    else if (latest.index <= firstIndex - 8) trendTrajectory = 'improving (increasing recovery)';
  }

  const baselineDiff = latest && latest.baseline !== null ? latest.index - latest.baseline : null;
  const detailedSummary = latest
    ? `Weekly Unit Load and Recovery Index trend across ${count} weeks (${trendTrajectory}). Current index: ${latest.index}${latest.baseline !== null ? ` (baseline: ${latest.baseline}, ${baselineDiff >= 0 ? `+${baselineDiff}` : baselineDiff} relative to baseline)` : ''}. Historical range: ${minIndex} to ${maxIndex}.`
    : `Weekly trend across ${count} weeks; no published index in this range.`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={detailedSummary}
        aria-hidden="false"
        focusable="false"
      >
        {/* Gridlines at 0/50/100, recessive */}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="var(--border-color)"
              strokeWidth="1"
            />
            <text x={PADDING.left - 8} y={yFor(v) + 4} fontSize="10" fill="var(--text-dim)" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {/* Baseline: dashed, neutral gray -- a reference line, not a competing category */}
        {baselineSegments.map((segment, si) => (
          <polyline
            key={`baseline-${si}`}
            points={segment.map((p) => `${xFor(p.i, count)},${yFor(p.value)}`).join(' ')}
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="2"
            strokeDasharray="5,4"
            strokeLinecap="round"
          />
        ))}

        {/* Index: solid, primary accent color, with markers */}
        {indexSegments.map((segment, si) => (
          <polyline
            key={`index-${si}`}
            points={segment.map((p) => `${xFor(p.i, count)},${yFor(p.value)}`).join(' ')}
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
        {points.map((p, i) =>
          p.index === null ? null : (
            <circle key={i} cx={xFor(i, count)} cy={yFor(p.index)} r="4" fill="var(--accent-blue)">
              <title>{`${shortWeekLabel(p.weekStart)}: index ${p.index}`}</title>
            </circle>
          )
        )}

        {/* X-axis week labels, sparse to avoid overlap */}
        {points.map((p, i) => {
          if (count > 6 && i % 2 !== 0 && i !== count - 1) return null;
          return (
            <text key={i} x={xFor(i, count)} y={HEIGHT - 6} fontSize="10" fill="var(--text-dim)" textAnchor="middle">
              {shortWeekLabel(p.weekStart)}
            </text>
          );
        })}
      </svg>

      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        <span>
          <svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" stroke="var(--accent-blue)" strokeWidth="2" /></svg>
          {' '}Index (approx.)
        </span>
        <span>
          <svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" stroke="var(--text-dim)" strokeWidth="2" strokeDasharray="4,3" /></svg>
          {' '}Baseline (approx.)
        </span>
      </div>

      {/* Accessible Chart Summary Callout */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderLeft: '3px solid var(--accent-blue)',
          padding: '0.6rem 0.9rem',
          margin: '0.85rem 0',
          borderRadius: '0 4px 4px 0',
          fontSize: '0.85rem',
          lineHeight: 1.5,
        }}
        role="region"
        aria-label="Accessible Trend Summary"
      >
        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>Accessible Trend Summary: </span>
        <span style={{ color: 'var(--text-muted)' }}>{detailedSummary}</span>
      </div>

      {hasWithheldWeeks && (
        <p className="card-desc" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Some weeks in this range are withheld for privacy and are shown as gaps, not as zero.
        </p>
      )}

      {/* Primary accessible representation: a real, keyboard-navigable table with the same values. */}
      <table className="data-table" style={{ marginTop: '1rem' }}>
        <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
          Weekly index and baseline values (text alternative to the chart above)
        </caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Index (approx.)</th>
            <th scope="col">Baseline (approx.)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.weekStart}>
              <th scope="row">{p.weekStart}</th>
              <td>{p.index === null ? 'Withheld' : p.index}</td>
              <td>{p.baseline === null ? '—' : p.baseline}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
