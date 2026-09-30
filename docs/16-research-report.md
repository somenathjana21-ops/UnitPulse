
# Unit Pulse 2.0  
## Research and Design Rationale for Aggregate-First Welfare Intelligence

**Problem Statement:** SIH 26186 — AI-Based Predictive Personnel Stress and Welfare Monitoring System for Uniformed Forces  
**Document type:** Focused research synthesis and prototype rationale  
**Version:** 1.0  
**Data policy:** Synthetic data only; no original participant or clinical data  
**Important interpretation:** Unit Pulse measures recorded **unit workload and recovery conditions**. It does not measure, diagnose, or predict an individual’s mental-health condition.

---

## Page 1 — Background, Evidence and Research Gap

### 1. Abstract

Uniformed personnel operate under combinations of irregular duty, prolonged deployment, night shifts, restricted recovery, family separation, operational uncertainty, and exposure to hazardous events. Government reports and occupational-health research identify these conditions as relevant to fatigue, psychological strain, burnout, errors, attrition, and reduced operational effectiveness. However, administrative records cannot determine whether a particular person is stressed, depressed, or experiencing a clinical disorder.

Unit Pulse 2.0 therefore adopts an **aggregate-first approach**. It analyses verified leave, duty, workload, and deployment records to produce a transparent **Unit Load & Recovery Index**. The index identifies unit-level conditions that may warrant review; it is not a clinical “stress score.” Commanders receive only privacy-checked unit summaries and organizational actions such as reviewing leave backlogs or night-duty distribution. If a unit significantly exceeds its historical baseline, the system creates a confidential report for an assigned welfare officer. Individual access is exceptional, time-limited, reasoned, and audited.

The prototype combines deterministic analytics with a constrained language model. Code calculates all metrics, scores, baselines, and triggers. The language model receives approved aggregate data only and translates it into possible contributors and supportive actions. The public demonstration uses a synthetic dataset of six fictional units and does not establish clinical validity or authorization for operational deployment.

### 2. Research method

This report is a **focused narrative synthesis**, not a systematic review or meta-analysis. Sources were selected from:

1. Government of India and parliamentary material concerning CAPF working conditions, leave, welfare, attrition, and suicide reporting.
2. Peer-reviewed Indian research involving CAPF or paramilitary personnel.
3. International occupational-health evidence on police and military shift work, fatigue, and recovery.
4. WHO, NIST, and OWASP guidance on workplace mental health, responsible AI, and application security.

Evidence is interpreted cautiously:

| Evidence type | Use in this report |
|---|---|
| Official or peer-reviewed | Background and design rationale |
| Credible reporting of official data | Context, with source limitations |
| International police/military research | Directional evidence; not assumed to transfer directly to Indian CAPFs |
| Prototype design assumption | Explicitly labelled and subject to pilot validation |

### 3. Occupational context

Stress, fatigue, burnout, and mental disorders are related but different constructs. **Fatigue** concerns reduced physical or mental capacity after sleep loss, prolonged duty, or inadequate recovery. **Burnout** is associated with prolonged occupational stress and commonly includes exhaustion, psychological distancing, and reduced professional efficacy. Depression, anxiety disorders, and PTSD require professional clinical assessment. Administrative workload data alone cannot establish any of these diagnoses.[8]

Official material describes eight-hour shifts as the general CAPF norm while acknowledging variation due to operational exigencies. Parliamentary discussions have repeatedly raised concerns about long duty hours, inadequate rest, difficult postings, leave availability, and limited recovery.[2–5] The operational setting differs substantially across forces and postings: border guarding, high-altitude service, counter-insurgency, election deployment, convoy duty, and continuous static-security shifts produce different workload patterns. A universal threshold is therefore less defensible than comparing a unit with its own recent, comparable history.

A cross-sectional study of 353 non-gazetted personnel from one CRPF battalion found 72.2% in the study’s moderate occupational-stress band and identified family separation, insufficient family time, and hazardous duties among associated factors.[6] This finding establishes relevance but cannot be generalized to all CAPFs because it involved one battalion, one assessment scale, and a cross-sectional design.

An earlier study of 160 disaster-response personnel from ITBP, CRPF, BSF, and CISF reported associations between burnout and force type, hierarchy, and limited time for hobbies.[7] The study is small, dates from 2012, and did not represent routine service conditions; it should be treated as hypothesis-generating rather than definitive.

International police shift-work research consistently links night duty and irregular schedules with poorer sleep, daytime sleepiness, injury risk, and reduced recovery.[8] Its direction is relevant, but effect sizes should not be presented as CAPF-specific without local validation.

### 4. Why organizational records are useful—but limited

The strongest administratively measurable conditions are not mental-health outcomes. They are **modifiable exposures**:

| Record | Unit-level indicator | Organizational lever |
|---|---|---|
| Leave eligibility and leave taken | Utilization and recovery coverage | Leave planning |
| Leave requests | Denial rate and pending backlog | Review delayed requests |
| Duty roster | Night-duty frequency and weekly hours | Redistribute shifts |
| Deployment history | Continuous deployment duration | Plan relief or rotation |
| Data coverage | Reliability of the weekly result | Correct source-data gaps |

These records can show that a unit has reduced recovery opportunities. They cannot show that every member of that unit is distressed or that a specific schedule caused a mental-health outcome.

Government-reported suicide and attrition figures demonstrate the importance of welfare but should not be treated as labels for model training or as proof that leave and duty patterns caused a particular incident. Differences in reporting populations—such as whether Assam Rifles or NSG are included—also limit direct comparison across sources.[3]

---

<div style="page-break-after: always;"></div>

# Page 2 — Translation of Evidence into the Prototype

## 5. Design hypothesis

Unit Pulse tests the following operational hypothesis:

> Verified, privacy-preserving unit aggregates can identify unusual workload and recovery conditions early enough for commanders and welfare officers to consider supportive organizational action without routinely exposing or ranking individuals.

This produces four design principles:

1. **Aggregate by default:** commanders see unit conditions, not personal stress labels.
2. **Explain every indicator:** each status is linked to verified leave, roster, workload, or deployment evidence.
3. **Support organizational action:** recommendations target controllable processes.
4. **Human welfare review:** the system creates a review opportunity, not an automatic personnel decision.

## 6. Unit indicators

The MVP processes completed weekly periods. Core windows and definitions are:

- **Leave utilization:** qualifying leave days taken ÷ verified eligible leave days during the preceding 90 days.
- **Days since qualifying leave:** measured from the end of the most recent verified restorative leave.
- **Recovery gap:** proportion of eligible personnel with more than 60 days since qualifying leave.
- **Leave denial rate:** denied requests ÷ decided requests; pending requests are excluded.
- **Leave backlog:** pending requests older than seven days.
- **Night-duty load:** average night duties per active person during the preceding 28 days.
- **Deployment continuity:** average current continuous deployment duration.
- **Weekly workload:** average recorded duty hours during the preceding seven days.

At least 80% verified coverage is required in each core source domain. Missing data are reported as **insufficient data**, never converted into zero workload or a reassuring status. Leave entitlements and qualifying leave types must be configurable because rules may differ across forces and personnel categories.

## 7. Unit Load & Recovery Index

The prototype begins with a deterministic, versioned rule set because no suitable, representative, ethically collected CAPF dataset with validated mental-health outcomes is available for training a clinical prediction model.

| Component | Illustrative MVP rule | Maximum |
|---|---|---:|
| Leave conditions | Days since leave, recovery gap, and denial rate | 30 |
| Night duty | Average 28-day night-shift frequency | 25 |
| Deployment | Continuous deployment duration | 20 |
| Workload | Mean seven-day recorded duty hours | 25 |
| **Total** | Non-clinical workload and recovery indicator | **100** |

Suggested display bands are:

- **0–39: Normal range**
- **40–69: Review**
- **70–100: Elevated**

These bands indicate administrative conditions, not low, moderate, or high psychological stress. Every result must display its leading contributing metrics and the data-coverage status.

If denial-rate evidence is unavailable because fewer than five decided requests exist, that feature is omitted and the remaining score is normalized. Historical comparisons use only weeks with the same score version and feature-availability mask.

### Baseline and report triggers

A unit’s baseline is the median of up to eight previous comparable completed weeks. At least four earlier comparable weeks are required for the spike rule.

A welfare report is created when either condition applies:

1. **Spike rule:** current index is at least 40 and at least 15 points above baseline.
2. **Sustained-high rule:** index is at least 75 for two consecutive completed weeks.

Only one active report is permitted per unit. Database constraints make weekly processing idempotent, so retries cannot create duplicate reports.

These thresholds are **prototype policy assumptions**. They are not derived from a validated clinical study and must be reviewed with welfare professionals and operational stakeholders before real use.

## 8. From evidence to action

The system recommends small organizational actions rather than clinical conclusions.

| Observed aggregate condition | Possible interpretation | Action for human review |
|---|---|---|
| Low leave utilization and large backlog | Recovery opportunities may be delayed | Review oldest pending requests |
| High recovery gap | A substantial part of the unit may lack recent leave | Prepare phased leave coverage |
| Concentrated night duty | Recovery burden may be unevenly distributed | Review roster distribution |
| Extended deployment | Rotation or relief may be delayed | Examine feasible relief plan |
| High recorded weekly hours | Unit workload may exceed recent conditions | Review task allocation and rest periods |
| Incomplete records | Result may be unreliable | Verify source data before intervention |

The language must remain conditional: “may indicate,” “consider reviewing,” or “warrants welfare review.” The platform must never state that a unit “has burnout” or that a person “is depressed.”

---

<div style="page-break-after: always;"></div>

# Page 3 — Architecture, AI, Privacy and Welfare Workflow

## 9. Prototype architecture

```text
Synthetic leave, duty and deployment records
                       │
                       ▼
Private Supabase PostgreSQL schema
                       │
          Validation and coverage checks
                       │
                       ▼
Exact private weekly metrics
                       │
        Deterministic index and baseline
                       │
                       ▼
Privacy release: suppression, coarsening,
and stable approximation of selected counts
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
Commander dashboard       Welfare report trigger
Unit aggregates only      Assigned officer only
             │                   │
             ▼                   ▼
Constrained AI briefing   Human review and follow-up
```

The proposed implementation uses:

- **Next.js and JavaScript** for role-specific dashboards and APIs.
- **Supabase PostgreSQL and Auth** for storage, authentication, RLS, assignments, and audit data.
- **Vercel** for the synthetic-data demonstration.
- **OpenAI-compatible server adapter** for switchable Nemotron/OpenAI-style providers.
- **Deterministic fallback templates** when an AI provider is unavailable.

Raw and exact calculated data remain in a private database schema. Commander-facing results are inserted into a separate RLS-protected release table. A PostgreSQL materialized view is not treated as the security boundary.

## 10. Language-model role

The language model does not calculate or modify the index, baseline, status, or report trigger. It receives only a privacy-approved aggregate object containing:

- Unit display code.
- Coarsened index and baseline.
- Permitted aggregate metrics.
- Trigger rule.
- Allow-listed evidence keys.
- Allow-listed supportive action categories.

Expected output is structured as:

1. Two or three possible contributing conditions.
2. Two or three simple actions for human review.
3. An urgency category.
4. A non-diagnostic disclaimer.

The backend validates the response schema and rejects:

- Names, personnel identifiers, or invented individuals.
- Diagnoses or unsupported causal language.
- Numbers not present in the approved input.
- Punitive or disciplinary recommendations.
- Actions outside the allow-list.

Displayed numerical sentences are assembled by server code from approved metrics rather than trusting model-generated figures. Invalid responses, timeouts, HTTP errors, or missing API credentials produce deterministic fallback text. This aligns the design with NIST’s emphasis on governable, transparent, and human-supervised AI.[9]

## 11. Privacy-preserving release

Privacy is an architectural requirement rather than a user-interface option.

### Aggregate safeguards

- A group with fewer than five eligible people is suppressed.
- Sensitive breakdowns and complementary cells that could expose fewer than five people are also suppressed.
- Arbitrary commander filters are not supported.
- Selected bounded person-count measures receive Laplace noise once per unit/week and are stored as a stable release.
- Reloading a page returns the same released value; noise is not resampled.
- Protected pages and APIs use `Cache-Control: no-store`.

The prototype uses `k = 5` and an illustrative `epsilon = 0.2` for selected bounded counts. These measures reduce disclosure risk but do **not** prove that the full system is k-anonymous or differentially private. Repeated periods, contextual knowledge, and overlapping data windows can still create inference risks.

### Role separation

| Role | Permitted access |
|---|---|
| Commander | Approved aggregates for assigned units |
| Welfare officer | Assigned aggregate reports and workflow status |
| HR uploader | Restricted data import and validation results |
| System worker | Server-side aggregation and release process |

Roles and unit assignments are maintained in protected tables. Request parameters cannot be used to self-declare a role or unit.

### Exceptional individual access

Individual records are not available to commanders. An assigned welfare officer may request a limited individual view only when an aggregate report requires further review. The officer must provide a reason linked to the report. The resulting grant:

- Is unit- and report-specific.
- Expires after 30 minutes.
- Returns only pseudonymous records.
- Does not provide bulk download.
- Logs every successful read.

The read is implemented through a transactional database function that verifies the officer, report, unit, grant, and expiry; writes the audit event; and only then returns a limited page. Ordinary direct access to private personnel tables remains prohibited.

## 12. Welfare process

```text
Elevated aggregate condition
        ↓
One confidential report created
        ↓
Assigned officer acknowledges
        ↓
Aggregate evidence reviewed
        ↓
Supportive action documented
        ↓
Optional justified individual review
        ↓
7/14-day follow-up and closure
```

The system does not automatically alter a roster, approve leave, determine fitness for duty, initiate discipline, or contact a commander about personal clinical details. Authorized humans remain responsible for operational feasibility and welfare decisions.

---

<div style="page-break-after: always;"></div>

# Page 4 — Validation, Limitations and Conclusion

## 13. Demonstration and evaluation plan

The prototype uses six fictional units with 60 synthetic personnel each and approximately 180 days of leave, roster, and deployment history. One unit is intentionally configured with worsening leave and night-duty conditions, while another remains stable. Additional fixtures test privacy and failure behavior.

### Technical evaluation

| Area | Acceptance criterion |
|---|---|
| Analytics | Identical verified input produces the same private score |
| Missing data | Insufficient coverage produces no index |
| Privacy | Groups and sensitive cells below five are absent from API and UI |
| Stable release | Repeated reads return the same approximate values |
| Authorization | Commander cannot access another unit or any individual record |
| Reporting | Repeated weekly jobs create no duplicate active report |
| Audit | Every authorized individual read creates a matching audit event |
| AI grounding | Unsupported figures, diagnoses, and punitive actions are rejected |
| Resilience | Main workflow operates in no-LLM mode |
| Export | Printed briefing contains aggregate data only |

### Future pilot evaluation

A sponsor-approved pilot should evaluate:

- Time from elevated condition to welfare-officer acknowledgement.
- Percentage of reports receiving documented human review.
- Officer-rated usefulness and feasibility of recommendations.
- Frequency and reasons for false or unhelpful alerts.
- Data completeness across different forces and posting types.
- Whether workload indicators improve after an intervention.
- Unauthorized-access and privacy-test failure rate.
- Trust and acceptability among personnel, commanders, and welfare staff.

Clinical sensitivity, specificity, or suicide-prediction accuracy must not be reported because the MVP has no validated clinical outcome labels.

## 14. Research limitations

1. **Administrative indicators are indirect.** Leave, night duty, deployment, and recorded hours describe organizational conditions, not a person’s actual mental state.
2. **Indian evidence is limited.** Available CAPF studies are generally cross-sectional, localized, or small. International findings may not transfer directly to Indian operational and cultural settings.
3. **Causality cannot be inferred.** An elevated indicator may coexist with welfare concerns without causing them. Operational events, staffing shortages, family circumstances, health, leadership, and data-quality issues may contribute.
4. **Thresholds are provisional.** Index weights, windows, bands, and alert thresholds require stakeholder review and prospective validation.
5. **Aggregate privacy is not absolute.** Suppression, coarsening, restricted filters, and stable noise reduce but do not eliminate inference risks.
6. **LLM explanations may be wrong.** Validation and fallback reduce this risk, but no generated text should replace professional or command judgement.
7. **Synthetic data prove workflow, not impact.** The demonstration cannot establish real-world effectiveness, fairness, or user trust.
8. **Public-cloud use is limited.** Vercel and Supabase are suitable for a synthetic prototype. Real force data require organizational approval, security accreditation, retention policy, vendor review, and approved hosting.
9. **No self-assessment in the MVP.** If psychological instruments are introduced later, participation must be voluntary, purpose-limited, appropriately licensed, and separated from routine commander access. Screening questionnaires support follow-up; they do not independently establish diagnoses.

## 15. Conclusion

The research supports monitoring **modifiable organizational exposures**—particularly leave utilization, recovery gaps, night duty, workload, and deployment continuity—while strongly cautioning against interpreting those records as individual mental-health diagnoses.

Unit Pulse 2.0 operationalizes this distinction. It gives commanders visibility into conditions they can influence, directs unusual aggregate patterns to welfare professionals, and makes person-level access exceptional and auditable. Its central innovation is therefore not merely a numerical index or an LLM briefing; it is the combination of:

- Transparent, deterministic workload analytics.
- Comparison against a unit’s own history.
- Aggregate-first disclosure.
- Evidence-grounded, non-clinical explanations.
- Human-led welfare intervention.
- Auditable privacy exceptions.

The MVP should be judged as a **privacy-preserving decision-support prototype**, not as a clinically validated stress-prediction system. A successful future deployment depends on representative local research, workforce consultation, professional welfare oversight, and strict prevention of disciplinary misuse.

---

## References

1. Ministry of Home Affairs / CRPF. **SIH Problem Statement 26186: AI-Based Predictive Personnel Stress and Welfare Monitoring System for Uniformed Forces.**
2. Ministry of Home Affairs. **Lok Sabha Unstarred Question 3437**, 7 August 2018: working hours, leave, rotation, and welfare measures.  
   `mha.gov.in/MHA1/Par2017/pdfs/par2018-pdfs/ls-07082018-English/3437.pdf`
3. Ministry of Home Affairs. **Rajya Sabha Unstarred Question 1036**, 4 December 2024: attrition, suicides, and welfare measures.  
   `mha.gov.in/MHA1/Par2017/pdfs/par2024-pdfs/RS04122024/1036.pdf`
4. Ministry of Home Affairs. **Rajya Sabha Unstarred Question 1038**, 4 December 2024: leave policy and force-level leave questions.  
   `mha.gov.in/MHA1/Par2017/pdfs/par2024-pdfs/RS04122024/1038.pdf`
5. PRS Legislative Research. **Working Conditions in Border Guarding Forces — Standing Committee Report Summary.**  
   `prsindia.org/policy/report-summaries/working-conditions-in-border-guarding-forces`
6. Singh G. et al. **Determinants of Occupational Stress among Non-Gazetted CRPF Jawans: A Cross-Sectional Study.** *Indian Journal of Occupational and Environmental Medicine*, 2025.  
   `pmc.ncbi.nlm.nih.gov/articles/PMC12017670/`
7. Kumar P., Dangi H. **Burnout amongst Paramilitary Personnel in India: A Study.** NIDM Journal, 2012.  
   `nidm.gov.in/journal/PDF/Journal/1Dec2012/1Dec2012d.pdf`
8. James L. et al. **Effects of shift-work schedules on sleep, health, safety, and quality of life of police employees.** *Frontiers in Psychology*, 2023.  
   `frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1128629/full`
9. World Health Organization. **Mental Health at Work** and **Burn-out as an Occupational Phenomenon.**  
   `who.int/news-room/fact-sheets/detail/mental-health-at-work`
10. National Institute of Standards and Technology. **AI Risk Management Framework.**  
    `nist.gov/itl/ai-risk-management-framework`
11. OWASP. **Application Security Verification Standard.**  
    `owasp.org/www-project-application-security-verification-standard/`
12. Supabase. **PostgreSQL Row Level Security Documentation.**  
    `supabase.com/docs/guides/database/postgres/row-level-security`

**Research note:** This is a selected-source narrative synthesis. Figures should be checked against the latest official publications before external submission. No original patient or personnel data were collected or analysed.