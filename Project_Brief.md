# Unit Pulse 2.0 — Project Brief

## Project Identity

- Project: Unit Pulse 2.0
- Problem Statement ID: 26186
- Category: Software
- Theme: MedTech / BioTech / HealthTech
- Organization: Ministry of Home Affairs
- Department: CRPF, Police II Division

## One-Line Pitch

Unit Pulse 2.0 is a privacy-first welfare intelligence platform that identifies elevated unit-level occupational strain from leave, duty, workload, and deployment patterns, explains the likely operational contributors, recommends simple welfare actions, and confidentially alerts authorized Welfare Officers.

## Problem

Personnel in uniformed services may experience extended deployments, irregular duty schedules, insufficient recovery periods, repeated leave denial, and heavy workloads.

Existing welfare identification often depends on manual observation or self-reporting. This can delay assistance. Individual risk labeling may also create stigma and reduce trust.

## Proposed Solution

Unit Pulse 2.0 follows an aggregate-first model.

It:

1. Imports anonymized HR, leave, duty, and deployment records.
2. Calculates privacy-safe unit-level metrics.
3. Produces a transparent Unit Strain Index from 0 to 100.
4. Compares each unit against its own rolling baseline.
5. Uses an OpenAI-compatible LLM to explain elevated indicators using only aggregate data.
6. Suggests three simple and non-disciplinary welfare actions.
7. Creates a confidential Welfare Officer report when trigger conditions are met.
8. Requires logged, time-limited break-glass authorization for individual-level access.

## Product Principles

1. Aggregate by default.
2. Welfare, never discipline.
3. No prediction without explanation.
4. AI explains; authorized humans decide.
5. No diagnosis from operational data.
6. Minimum necessary access.
7. Every sensitive access must be auditable.

## Primary Users

### Commander

Can see:

- Unit-level strain indicators
- Leave utilization
- Duty and deployment trends
- Recommended operational actions

Cannot see:

- Individual stress labels
- Private welfare notes
- Individual self-assessment responses

### Welfare Officer

Can see:

- Aggregate dashboards
- Triggered welfare reports
- Follow-up status
- Time-limited individual information after approved break-glass access

### HR/Data Administrator

Can:

- Upload and validate approved datasets
- View ingestion status and data-quality errors

Cannot:

- Read confidential welfare notes unless separately authorized

## MVP Scope

- Six synthetic units with approximately 60 personnel each
- Ninety days of leave, duty, workload, and deployment data
- Unit dashboard and unit detail page
- Unit Strain Index and rolling baseline
- K-anonymity suppression for groups smaller than five
- AI-generated reasons and three suggested actions
- Automatic Welfare Officer report creation
- Welfare report workflow
- Break-glass request and audit log
- Switchable OpenAI-compatible AI provider
- PDF/print-friendly welfare briefing

## Out of Scope for MVP

- Medical diagnosis
- Facial, voice, or emotion recognition
- Monitoring private calls, messages, or social media
- Automated disciplinary, promotion, or deployment decisions
- Production integration with classified systems
- Compulsory biometric collection
- Fully autonomous intervention

## Technology Stack

- Next.js App Router
- React
- JavaScript
- HTML and CSS
- Supabase Auth
- Supabase PostgreSQL
- Next.js Route Handlers
- Recharts
- Vercel
- OpenAI-compatible LLM API
- Nemotron-compatible provider configuration

## Success Criteria

- All commander views remain aggregate-only.
- Groups smaller than five are suppressed.
- Unit scores show contributing factors.
- Triggered conditions create one deduplicated welfare report.
- AI receives no direct personnel identifier.
- AI output contains evidence-grounded reasons, actions, urgency, and disclaimer.
- Break-glass access requires a reason and expiry.
- Every sensitive access is recorded in an immutable-style audit trail.
- Core dashboard loads smoothly using precomputed metrics.

## Safety Statement

The Unit Strain Index is an operational welfare planning indicator. It is not a medical diagnosis and must not be used as evidence of individual psychological fitness, misconduct, or eligibility for promotion or deployment.