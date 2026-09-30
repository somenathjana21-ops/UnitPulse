Keep the final submission to **six slides, including the title slide**. Delete the instruction slide before exporting to PDF.

Use short statements, diagrams, icons, screenshots, and metric cards. Avoid dense paragraphs.

---

## Slide 1 — Title Page

### Main title

**UNIT PULSE 2.0**

### Subtitle

**Privacy-First, Leave-Aware Welfare Intelligence for Uniformed Forces**

### Template fields

- **Problem Statement ID:** 26186
- **Problem Statement Title:** AI-Based Predictive Personnel Stress and Welfare Monitoring System for Uniformed Forces
- **Theme:** MedTech / BioTech / HealthTech
- **PS Category:** Software
- **Organization:** Ministry of Home Affairs
- **Department:** CRPF, Police II Division
- **Team ID:** `[Enter Team ID]`
- **Team Name:** `[Enter Registered Team Name]`

### Bottom tagline

> **Detect unit-level occupational strain early—without exposing individuals.**
> 

### What to show

On the right side, place a simple shield-style visual containing:

```
LEAVE + DUTY DATA
        ↓
UNIT HEALTH SIGNAL
        ↓
EARLY WELFARE ACTION
```

Use three icons:

- Calendar/leave
- Analytics pulse
- Shield/welfare

---

## Slide 2 — Proposed Solution

### Heading

**UNIT PULSE 2.0: FROM OPERATIONAL DATA TO WELFARE ACTION**

### Central flow diagram

Place this horizontally in the center:

```
HRMS / Leave / Duty Data
          ↓
Privacy-Preserving Aggregation
          ↓
Unit Strain Index + Unit Baseline
          ↓
AI-Grounded Reasons
          ↓
3 Simple Welfare Actions
          ↓
Confidential Welfare Report
```

### Left section — What the solution does

- Analyses leave utilization, leave denial, recovery gaps, night duties, workload, and deployment continuity.
- Computes a transparent **Unit Strain Index: 0–100**.
- Compares each unit against its own rolling operational baseline.
- Explains elevated indicators using only aggregate evidence.
- Recommends three practical, non-disciplinary actions.
- Automatically notifies an authorized Welfare Officer when trigger conditions are met.

### Right section — Innovation and uniqueness

Use four highlighted cards:

#### Aggregate-first

Commanders see unit trends—not individual “stress labels.”

#### Leave-aware intelligence

Identifies leave backlog, recovery gaps, denial patterns, and unequal leave utilization.

#### Privacy by design

Minimum group size, role-based access, pseudonymization, and complete audit trails.

#### AI explains—humans decide

The score is deterministic and transparent. AI only explains evidence and suggests support.

### Bottom callout

> **No names are sent to the LLM. No medical diagnosis. No automatic disciplinary decision.**
> 

---

## Slide 3 — Technical Approach

### Heading

**TECHNICAL APPROACH**

### Main architecture diagram

Use approximately 65% of the slide for this diagram:

```
┌─────────────────────────────┐
│ HRMS / Synthetic CSV Input  │
│ Leave • Duty • Deployment   │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Supabase PostgreSQL         │
│ Auth • RLS • Audit Logs     │
│ Precomputed Unit Metrics    │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Transparent Analytics       │
│ Index • Baseline • Triggers │
│ K-anonymity: n ≥ 5          │
└───────┬─────────────┬───────┘
        ↓             ↓
┌──────────────┐  ┌───────────────────┐
│ Commander    │  │ Welfare Officer   │
│ Aggregate    │  │ Reports and       │
│ Dashboard    │  │ Follow-up         │
└──────────────┘  └─────────┬─────────┘
                            ↓
                  ┌────────────────────┐
                  │ Break-Glass Access │
                  │ Reason + Expiry +  │
                  │ Complete Audit Log │
                  └────────────────────┘
```

### Technology strip

Place logos or text icons along the bottom:

- **Frontend:** Next.js, React, HTML, CSS, JavaScript
- **Backend:** Next.js Route Handlers, Supabase
- **Database:** PostgreSQL
- **Hosting:** Vercel
- **Charts:** Recharts
- **AI:** OpenAI-compatible adapter—Nemotron/OpenAI-compatible models
- **Security:** Supabase Auth, RLS, TLS, AES-GCM for sensitive notes

### Methodology box

```
Ingest → Validate → Aggregate → Score → Compare Baseline
→ Explain → Recommend → Escalate → Audit
```

### Small formula box

```
Unit Strain Index =
Leave Strain (30)
+ Night Duty (25)
+ Deployment (20)
+ Workload (15)
+ Optional Anonymous Wellness Trend (10)
```

---

## Slide 4 — Feasibility and Viability

### Heading

**FEASIBILITY AND VIABILITY**

Use a three-column layout.

### Column 1 — Why it is feasible

- Uses existing HRMS, leave, roster, and deployment records.
- Does not require compulsory wearables or private communication monitoring.
- Explainable rule-based MVP works before historical labels are available.
- Serverless deployment reduces infrastructure complexity.
- Modular AI provider prevents vendor lock-in.
- PWA-ready architecture supports future mobile adoption.

### Column 2 — Key risks

- Incomplete or inconsistent HR data
- False or delayed alerts
- Re-identification of small groups
- AI-generated unsupported statements
- Unauthorized access to welfare records
- Lack of personnel trust
- Operational baselines may vary by unit

### Column 3 — Mitigation

- Schema validation and data-quality indicators
- Unit-specific baseline plus multi-condition triggers
- Suppression when group size is below five
- Structured AI output using aggregate evidence only
- RLS, encryption, audit logs, and time-limited access
- Welfare-only policy and transparent explanations
- Human review before any intervention

### Bottom feasibility pipeline

```
MVP: Synthetic Data
  → Controlled Pilot
  → Threshold Calibration
  → HRMS Integration
  → Audited Organizational Rollout
```

### Highlighted statement

> **The system assists welfare planning; it never makes medical, disciplinary, promotion, or deployment decisions.**
> 

---

## Slide 5 — Impact and Benefits

### Heading

**IMPACT AND BENEFITS**

### Center “before versus after” visual

| Reactive process | Unit Pulse 2.0 |
| --- | --- |
| Issues noticed after escalation | Early operational warning |
| Manual interpretation of records | Continuous unit-level trends |
| Individual stigma risk | Aggregate-first visibility |
| Generic advice | Evidence-linked actions |
| Untracked data access | Audited and time-limited access |

### Stakeholder impact cards

#### Personnel

- Reduced stigma and surveillance concerns
- Fairer leave and recovery planning
- Earlier access to welfare support
- Better confidentiality

#### Commanders

- Unit health heatmap
- Leave backlog and workload visibility
- Practical roster-balancing actions
- No access to private wellness details

#### Welfare Officers

- Prioritized confidential report inbox
- Evidence-grounded reasons
- Follow-up workflow
- Controlled break-glass access

#### Organization

- Proactive welfare management
- Improved readiness and resilience
- Better resource allocation
- Auditable, privacy-conscious governance

### Pilot success indicators

Label these as **pilot targets**, not guaranteed results:

- Reduce unresolved leave backlog
- Reduce prolonged no-leave periods
- Reduce repeated night-duty concentration
- Welfare reports acknowledged within 48 hours
- 100% individual-level access auditable
- Zero individual identifiers sent to external LLMs

---

## Slide 6 — Research and References

### Heading

**RESEARCH AND REFERENCES**

Use three sections.

### Occupational health and well-being

- World Health Organization — Mental health at work`https://www.who.int/news-room/fact-sheets/detail/mental-health-at-work`
- International Labour Organization — Psychosocial risks and work-related stress`https://www.ilo.org/`
- WHO — ICD-11 description of burnout as an occupational phenomenon`https://www.who.int/standards/classifications/classification-of-diseases`

### Privacy, AI, and security

- Digital Personal Data Protection Act, 2023`https://www.meity.gov.in/`
- NIST AI Risk Management Framework`https://www.nist.gov/itl/ai-risk-management-framework`
- OWASP Application Security Verification Standard`https://owasp.org/www-project-application-security-verification-standard/`
- OWASP Top 10 for Large Language Model Applications`https://owasp.org/www-project-top-10-for-large-language-model-applications/`

### Technology references

- Next.js Documentation — `https://nextjs.org/docs`
- Supabase Documentation — `https://supabase.com/docs`
- PostgreSQL Row-Level Security — `https://www.postgresql.org/docs/current/ddl-rowsecurity.html`
- Vercel Documentation — `https://vercel.com/docs`
- NVIDIA API Catalog — `https://build.nvidia.com/`

### Bottom prototype note

> **Prototype uses synthetic/anonymized data. Thresholds require validation with authorized domain experts before real-world use.**
>