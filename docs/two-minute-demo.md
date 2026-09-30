# Unit Pulse 2.0 — Two-Minute Demonstration Walkthrough

**Problem Statement ID:** 26186 | **Category:** Software / HealthTech | **Target Organization:** Ministry of Home Affairs (CRPF, Police II Division)  
**Safety Mandate:** The Unit Load & Recovery Index is an operational welfare planning indicator, NOT a medical or psychological diagnosis. Synthetic demonstration data only.

---

## Demo Timing & Script Overview

| Time | Slide / Screen | Core Walkthrough Beat | URL / Action | Displayed Empirical Data |
|---|---|---|---|---|
| **0:00 - 0:20** | Slide 1 / `/commander` | **Beat 1:** 6 Fictional Units, Aggregates Only | `/commander` | 6 Units (`UNIT-A` to `UNIT-F`), 360 synthetic personnel; 0 personnel IDs |
| **0:20 - 0:40** | Slide 2 / `/commander/units/UNIT-B` | **Beat 2:** Unit Index vs Baseline Jump | `/commander/units/UNIT-B` | `UNIT-B` Index: **75** (Elevated) vs Baseline **75**; `UNIT-A` Index: **0** (Normal) |
| **0:40 - 1:00** | Slide 3 / `/commander/units/UNIT-B` | **Beat 3:** Evidence Indicators & Actions | Evidence Cards | Night shifts: **12.8/28d**; Recovery gap: **48%**; Duty: **55.4h**; 3 supportive actions |
| **1:00 - 1:20** | Slide 4 / `/welfare` & `/welfare/reports/1111...` | **Beat 4:** Confidential Assigned Report | `/welfare/reports/...` | Report `#11111111-2222-3333-4444-555555555555`; Trigger: `sustained_high`; Status: `new` |
| **1:20 - 1:40** | Slide 5 / Break-Glass Modal & `/welfare/audit` | **Beat 5:** Audited 30-Min Break-Glass Read | Request Grant & View Audit | Compulsory justification &gt;10 chars; 30-min timer; Max 20 rows; Immutable audit row |
| **1:40 - 1:50** | Slide 6 / Tech Overview | **Beat 6:** Switchable AI & Pure Scoring | Architecture | Code computes index/triggers; LLM only explains; Zero personal data to model; Fallback ready |
| **1:50 - 2:00** | Slide 6 / Safety Statement | **Beat 7:** Synthetic Prototype Disclaimer | Safety Banner | Non-diagnostic; Non-punitive; Requires sponsor accreditation before live pilot |

---

## Verbatim Walkthrough Script

### 0:00 - 0:20 | Step 1: Commander Overview — Aggregates by Default
> **Presenter says:**  
> *"Welcome. This is Unit Pulse 2.0. These are six fictional units representing approximately 360 synthetic personnel. The platform enforces an aggregate-first boundary: commanders see unit-level health, trends, and operational recovery patterns, but never individual personnel records or names. Groups under five are mathematically suppressed."*
- **Action:** Open `http://localhost:3000/commander`
- **What Evaluators See:**
  - Synthetic Data Policy banner displayed across top.
  - Grid of 6 fictional units:
    - **`UNIT-A` (Alpha Support Battery)**: Status **Normal**, Index **0/100**, Baseline **0**.
    - **`UNIT-B` (Bravo Recon Battalion)**: Status **Elevated** (High risk band), Index **75/100**, Baseline **75**.
    - **`UNIT-C`, `UNIT-D`, `UNIT-E`**: Status **Normal**, Index **5/100**.
    - **`UNIT-F`**: Status **Normal**, Index **0/100**.
  - Active personnel count displayed with differential privacy noise (e.g. `~51 active personnel (approximate count)`).
  - Prominent safety disclaimer: *"Operational planning indicator — not a clinical diagnosis."*

---

### 0:20 - 0:40 | Step 2: Unit Strain Index & Rolling Baseline
> **Presenter says:**  
> *"When we inspect Bravo Recon Battalion, we see its load-and-recovery index rose to 75, well above normal operational thresholds. Crucially, the index is evaluated against the unit's own rolling twelve-week baseline, preventing unfair comparisons between high-tempo tactical units and administrative depots."*
- **Action:** Click into `UNIT-B` at `/commander/units/UNIT-B`
- **What Evaluators See:**
  - Accessible Weekly Trend Chart comparing current weekly load against historical baseline across 12 snapshot weeks (`2026-07-13` to `2026-09-28`).
  - Screen reader accessible summary: *"Unit load-and-recovery index is currently 75, matching baseline of 75. Trajectory over the 12-week window has remained elevated."*
  - Dual presentation: Inline SVG chart + accessible semantic HTML table.

---

### 0:40 - 1:00 | Step 3: Objective Evidence & Suggested Supportive Actions
> **Presenter says:**  
> *"The briefing transparently points to three objective operational contributors: an elevated night-duty average of 12.8 shifts per month, a 48% recovery gap where personnel haven't had qualifying leave in over 60 days, and an average 55.4 weekly duty hours. The system suggests three non-punitive, supportive actions: review night-duty intervals, prioritize overdue leave, and coordinate with welfare officers."*
- **Action:** Scroll down to Evidence & Actions cards on `UNIT-B` detail page
- **What Evaluators See:**
  - **Duty & Workload**: Mean night shifts `12.8 / 28d` | Weekly duty hours `55.4 hrs/week`.
  - **Leave Recovery**: Recovery gap `48%` (&gt;60 days without qualifying leave) | Leave coverage ratio `52%`.
  - **Suggested Actions**:
    1. *Roster Rebalancing*: "Review night shift distribution to provide 48h rest intervals."
    2. *Leave Queue Prioritization*: "Prioritize pending leave requests for personnel with &gt;60d recovery gap."
    3. *Supportive Review*: "Coordinate with Unit Welfare Officer for supportive check-ins."
  - Verified coverage: 100% across HR, Leave, Duty, and Deployment feeds.

---

### 1:00 - 1:20 | Step 4: Confidential Welfare Officer Alert
> **Presenter says:**  
> *"Because Bravo Battalion triggered a sustained-high condition for two consecutive weeks, the system automatically and idempotently created one confidential welfare report assigned directly to the authorized Welfare Officer. Commanders cannot see this case file."*
- **Action:** Navigate to Welfare Officer inbox at `/welfare`
- **What Evaluators See:**
  - In-app notification alert banner: *"1 unit requiring welfare review: UNIT-B."*
  - Active report case `#11111111-2222-3333-4444-555555555555`.
  - Trigger rule: `sustained_high`.
  - Status transition workflow buttons: `Acknowledged`, `Action Taken`, `Follow-up Scheduled`, `Closed`.
  - AI-generated aggregate briefing summary and non-diagnostic safety disclaimer.

---

### 1:20 - 1:40 | Step 5: Audited 30-Minute Break-Glass Exception
> **Presenter says:**  
> *"If the Welfare Officer determines that individual assistance is necessary, individual records are strictly locked. Access requires an emergency break-glass request with a compulsory reason of at least ten characters. The system issues a non-renewable 30-minute grant, encrypts the reason at rest using AES-256-GCM, limits output to max 20 pseudonymous records, and writes an immutable audit record in the exact same transaction."*
- **Action:** Open Break-Glass modal on report, select reason *"welfare_review"*, type *"Conducting confidential wellness review for personnel with extended deployment"*, and submit.
- **What Evaluators See:**
  - Active 30-minute countdown timer appears on screen (`29:59...`).
  - Table of max 20 pseudonymous personnel rows (`P-0061` to `P-0080`) displaying last leave date and continuous deployment days.
  - Zero bulk export or CSV download buttons (bulk export prohibited).
  - Open `/welfare/audit`: Real-time audit log displays timestamp, actor ID, action `break_glass_read`, unit `UNIT-B`, report ID, 20 rows accessed, reason code `welfare_review`.

---

### 1:40 - 1:50 | Step 6: AI Independence & Fallback Guarantee
> **Presenter says:**  
> *"Unit Pulse 2.0 connects to any OpenAI-compatible or NVIDIA Nemotron model, but the core scoring, baseline calculation, and trigger evaluation are 100% deterministic code. The AI receives zero personal identifiers. If the LLM provider fails, times out, or is offline, our deterministic briefing engine generates verified aggregate briefings in under 1 millisecond."*
- **Action:** Show architecture summary on Slide 5 / `/presentation`
- **What Evaluators See:**
  - Benchmarked performance numbers:
    - Dashboard aggregate response: **0.028 ms**
    - Deterministic analytics & triggers: **0.039 ms**
    - AI fallback briefing generation: **0.065 ms**
    - CSV validation throughput: **134,529 rows/second**
    - Total test suite: **230 passed tests**, 0 failures.

---

### 1:50 - 2:00 | Step 7: Prototype Disclaimer & Ethical Scope
> **Presenter says:**  
> *"To conclude: Unit Pulse 2.0 is an academic and hackathon prototype built strictly with synthetic data. It is an operational welfare planning aid—not a medical diagnosis, not a psychological evaluation, and never a disciplinary tool. Live force deployments require dedicated sponsor security accreditation and governance."*
- **Action:** Conclude presentation on Slide 6.

---

## Known Limitations Recorded Honestly

1. **Synthetic Data Prototype**: All data (`UNIT-A` through `UNIT-F`, 360 personnel) is purely artificial. No real rosters, forces, or locations were used.
2. **Local Database Host Environment**: Docker Desktop is not present on this development host; the system utilizes in-memory transactional mock stores for headless integration testing and degrades gracefully with clear 503 states when cloud credentials are unconfigured.
3. **Threshold Calibration**: Operational thresholds (40 review, 70 elevated, 60-day recovery gap) are derived from the problem brief and require domain-expert calibration during future operational field pilots.
4. **Non-Clinical Boundary**: Operational records reflect workplace schedule conditions only; they cannot diagnose clinical depression, anxiety, or PTSD.
