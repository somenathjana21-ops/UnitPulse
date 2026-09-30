# 01 — Problem Statement and Scope

## Source

Smart India Hackathon Problem Statement **26186**: “AI-Based Predictive Personnel Stress and Welfare Monitoring System for Uniformed Forces.” Sponsoring organization: Ministry of Home Affairs; department: CRPF / Police II Division.

## Original need

The supplied statement describes physically demanding and psychologically stressful service conditions. It requests earlier identification of possible stress, burnout, fatigue, and welfare concerns using organizational records and optional voluntary wellness information, with privacy, confidentiality, and a supportive—not disciplinary—purpose.

## Our interpretation

HR data cannot directly determine whether someone is stressed. It can show potentially important **working conditions**:

- Long intervals without qualifying leave.
- A backlog or high denial rate of leave requests.
- Concentrated night duty.
- Prolonged deployments.
- High recorded working hours.

The MVP therefore detects **unit-level load and recovery indicators**, not individual mental-health conditions.

## Key design question

How can commanders see enough to improve rosters and leave planning without giving them a list of “high-risk personnel”?

**Answer:** Default to approved unit aggregates. Escalate elevated patterns to authorized welfare staff. Require a justified, logged exception for individual records.

## MVP coverage of the supplied statement

| Requested capability | MVP response |
|---|---|
| HR/deployment/leave/workload analysis | Included using synthetic data |
| Predictive behavioral analytics | Historical baseline and rising-pattern triggers; not a validated clinical predictor |
| Welfare monitoring dashboard | Included for commander and welfare roles |
| Welfare recommendations | Included, based on documented aggregate metrics |
| Automated authorized alerts | In-app assigned welfare reports |
| Role-based privacy and secure storage | Included |
| Mobile wellness/self-assessment app | Responsive web foundation; optional self-reporting deferred |
| Voluntary biometric integration | Deferred; never required |

## Non-negotiable constraints

- No disciplinary or promotion uses.
- No private communications monitoring.
- No diagnosis or automatic fitness-for-duty decision.
- No real personnel or sensitive operational data in the public prototype.
- A human welfare officer evaluates alerts and selects interventions.

## Open validation needs

The score weights, comparison windows, and alert thresholds are **prototype assumptions**. A real pilot requires input from welfare professionals, personnel representatives, organizational policy owners, privacy/security specialists, and legal counsel.