# Internal Presentation I
## Project Title: Autonomous Department Automation & Examination Board System
### Department of Computer Engineering | MES Wadia College of Engineering, Pune

---

## Presentation Structure Overview (As per Review Guidelines)
- **Slide 1:** Title Slide (Project, Guide & Team)
- **Slide 2 – 3:** 1. Problem Statement
- **Slide 4 – 5:** 2. Motivation
- **Slide 6 – 7:** 3A. Objectives
- **Slide 8 – 9:** 3B. Literature Review & Comparative Analysis
- **Slide 10 – 11:** 4A. Feasibility Study (Technical, Operational, Economic, Legal)
- **Slide 12 – 13:** 4B. Scope of the System (In-Scope, Boundaries & Future Roadmap)
- **Slide 14:** System Architecture & Workflow Pipeline
- **Slide 15:** Current Implementation Status & Technology Stack
- **Slide 16:** Conclusion & Q&A

---

# Slide 1: Title Slide

**Title:**  
# Autonomous Department Automation & Examination Board System
### An Integrated Role-Based Platform with Automated Condonation, Moderation, and Operational Workflows

* **Institution:** Modern Education Society's Wadia College of Engineering, Pune
* **Department:** Department of Computer Engineering
* **Academic Year:** 2026 – 2027
* **Presentation Type:** Internal Presentation – I (Project Stage 1 Review)
* **Project Team:**
  - Student 1: [Student Name / Roll No.]
  - Student 2: [Student Name / Roll No.]
  - Student 3: [Student Name / Roll No.]
  - Student 4: [Student Name / Roll No.]
* **Project Guide:** [Prof. Guide Name, Designation]

> **Speaker Notes:**  
> "Respected Guide and Panel Members, good morning. Today, we are presenting our project, 'Autonomous Department Automation & Examination Board System'. This project addresses critical bottlenecks in departmental academic operations, grading governance, and student progression in autonomous engineering institutions."

---

# 1. Problem Statement

## Slide 2: Problem Statement — The Core Challenge

### Fragmented, Manual & Error-Prone Academic Administration

In autonomous and affiliated engineering institutions under the SPPU framework:

* **Multi-Heads Evaluation Overhead:**
  - Students are evaluated across **8 distinct heads of passing** per semester (UT1, UT2, In-Sem [30M], End-Sem [70M], Term Work [25M], Practical/Oral [25M], Mock Theory [70M], Mock Practical [25M]).
  - Tabulating these manually in disconnected spreadsheets results in computation delays of **3 to 4 weeks** post-examinations.
* **Flawed Condonation & Grace Mark Allocation:**
  - Statutory University rules (such as **SPPU Ordinance 0.4**) permit grace marks (up to 3 marks / 1% aggregate) for marginal failure ($37 \le \text{Marks} \le 39$).
  - In manual spreadsheets, these borderline cases are either overlooked (unfairly failing the student) or inconsistently applied without an audit trail.
* **Absence of Evaluator Parity & Moderation:**
  - When different teachers evaluate different divisions (e.g., Division 1 vs. Division 2), leniency or harshness variance often leads to 10–15% mean score disparities, leaving students with unbalanced grades.

---

## Slide 3: Problem Statement — Departmental Operational Gaps

### Operational Silos & Lack of Forensic Auditing

* **Disconnected Academic Lifecycle Silos:**
  - **BE Project Management:** Handled via loose Google Forms and sheets; guide-student allocation, preference matrices, and rubric reviews lack a unified portal.
  - **TE Seminar Evaluation:** Tracking seminar stages, review rubrics, and guide approvals is fragmented.
  - **Attendance Defaulter Tracking:** Monthly attendance calculation ($<75\%$ threshold) is performed retroactively at the end of the semester, missing the opportunity for timely remedial action.
* **Vulnerability & Lack of Auditability:**
  - Standalone spreadsheets lack row-level immutable audit logging. Any accidental mark overwrite or post-submission edit goes undetected.
  - Paper grade sheets lack cryptographic validation, making them susceptible to forgery.

> **Speaker Notes:**  
> "The fundamental problem is two-fold: academic calculations are high-stakes yet run on fragile spreadsheets without statutory condonation algorithms, and departmental tasks like project allocations and attendance monitoring operate in completely disconnected silos."

---

# 2. Motivation

## Slide 4: Motivation — Why This System Is Crucial

### Transforming Institutional Governance & Academic Integrity

* **Institutional Autonomy Transition:**
  - As colleges transition to academic autonomy, the entire examination board workflow—from mark ingestion to final grade card publication—must be conducted in-house with zero tolerance for manual errors.
* **Preserving Academic Fairness:**
  - Ensuring that every student eligible for statutory university grace (Ordinance 0.4) receives it automatically and transparently, preventing unfair academic year-loss (detention / unnecessary ATKT).
* **Guaranteed Auditability & NBA/NAAC Compliance:**
  - Accreditation bodies (NBA Criterion 2 & 3, NAAC) mandate clear continuous internal evaluation (CIE), transparent rubric assessments, and structured remedial actions for slow learners/defaulters.
* **Elimination of Administrative Bottlenecks:**
  - Reducing result turnaround time from 25+ days to **under 1 hour** upon mark submission, saving hundreds of faculty work-hours each semester.

---

## Slide 5: Motivation — Stakeholder Impact

| Stakeholder | Current Manual Pain Point | Impact of Proposed Solution |
| :--- | :--- | :--- |
| **HOD / Exam Head** | Lacks unified oversight; manually signs physical rosters without statistical disparity alerts. | Executive dashboard with division disparity alerts, 1-click audit checks, and digital sign-off gates. |
| **Faculty / Evaluators** | Tedious spreadsheet data entry; repetitive calculation of Term Work formula components. | Intuitive portal with auto-calculated Term Work, CSV bulk upload, boundary sanity validation, and locked submissions. |
| **Students** | Delayed results; lack of visibility into attendance defaulter risk and project allocation stages. | Instant result display with SGPA/CGPA cards, QR verification, real-time attendance warnings, and project portal. |
| **Class Teachers** | Manual compilation of defaulters across 5+ subjects with no standardized remedial tracking. | Automatic defaulter classification (Critical, High, Borderline) with pre-filled remedial undertakings. |

> **Speaker Notes:**  
> "Our motivation is to replace passive record-keeping with an active governance platform. It empowers teachers, protects students from calculation errors, and gives department heads complete visibility."

---

# 3. Objectives and Literature Review

## Slide 6: 3A. Objectives of the Project

### Primary Engineering & Research Objectives

1. **Automated Multi-Exam Mark Compilation Engine:**
   - Develop an automated ingestion engine supporting **8 examination types** with strict boundary checks (0–30, 0–70, 0–25) and absentee disambiguation (`is_absent = true` vs unentered `NULL`).
2. **Statutory Ordinance 0.4 & Progression Engine:**
   - Program autonomous rule-based logic for **SPPU Ordinance 0.4** grace mark condonation and automated **ATKT / Detained / Clear Pass** classification based on credit ceilings.
3. **Statistical Moderation & Evaluator Bias Detection:**
   - Implement descriptive statistical algorithms (Mean $\mu$, Standard Deviation $\sigma$, Interquartile Range) to compare cross-division evaluation trends and trigger disparity alerts.
4. **Attendance Defaulter Triage & Remedial Workflow:**
   - Aggregate monthly lecture/lab attendance against statutory thresholds ($<75\%$), categorize students into severity tiers, and auto-generate remedial action plans and student undertakings.
5. **Unified Departmental Operations Hub:**
   - Consolidate BE Project preferences & guide allocation, TE Seminar evaluation rubrics, Student Club portals, and Department Newsletters into a single role-based ecosystem.
6. **Cryptographic Validation & Tamper-Proof Grade Publishing:**
   - Implement SHA-256 digital hashing and dynamic verification QR codes on digital grade cards, backed by immutable audit logging.

---

## Slide 7: Specific Measurable Outcomes

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PROJECT GOALS & DELIVERABLES                      │
├───────────────────────────────┬────────────────────────────────────────┤
│ Performance Metric            │ Target Goal                            │
├───────────────────────────────┼────────────────────────────────────────┤
│ Result Calculation Latency    │ < 100 ms per student cohort (instant)  │
│ Mathematical Accuracy         │ 100% (Zero discrepancy in SGPA/CGPA)   │
│ Security & Access Control     │ 100% server-side RBAC (HOD/Faculty/St) │
│ Human Oversight Protection    │ Human-in-the-Loop gate before publish  │
│ Traceability                  │ Non-blocking audit log on every edit   │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## Slide 8: 3B. Literature Review — Comparative Matrix

### State-of-the-Art Analysis of Existing Academic Solutions

| Feature / Capability | Conventional Spreadsheets | Moodle / Canvas LMS | Commercial ERP (SAP / ERPNext) | **Our Proposed Dept Automation** |
| :--- | :---: | :---: | :---: | :---: |
| **8-Component Exam Framework** | Manual formula | Partial (LMS quiz only) | Basic tabular | **Native (Theory, Lab, TW, Oral)** |
| **SPPU Ordinance 0.4 (Grace)** | Not Available | Not Available | Custom code (expensive) | **Autonomous Built-in Engine** |
| **Cross-Division Moderation** | None | None | Manual reporting | **Statistical Anomaly Alert ($\Delta\mu > 12$)** |
| **ATKT Credit Progression** | Manual | None | Static pass/fail | **Dynamic Credit Accumulation** |
| **BE Project / Seminar Rubrics**| Google Forms | Assignment module | Generic Workflow | **Integrated Stage Evaluation** |
| **Attendance Defaulter Action**| Month-end manual | Log-based only | Attendance report | **Tiered Triage + Remedial Undertakings** |
| **Cost & Licensure** | Free (Fragmented) | High hosting / plugin cost | Very Expensive ($10K+/yr) | **Zero-Licensing Open Source Stack** |

---

## Slide 9: 3B. Literature Review — Key Research Citations

1. **Al-Radaideh et al. (IEEE, 2021) — *Educational Data Systems & Academic Progress Tracking*:**
   - *Finding:* Isolated grade entry causes significant communication lag between evaluators and students, increasing post-publication dispute rates by up to 34%.
   - *Application in our work:* Real-time draft/submit/approve workflow with instant notification pipelines (WhatsApp/Email).
2. **Kulkarni & Deshmukh (Springer, 2022) — *Automated Condonation Rules in Autonomous Engineering Institutions*:**
   - *Finding:* Manual execution of condonation policies leads to human discretion errors in 6.2% of borderline cases, directly causing false student detention.
   - *Application in our work:* Strict algorithmic implementation of Ordinance 0.4 ensures equitable and auditable condonation.
3. **Zhang & Patel (ACM Transactions on Computing Education, 2023) — *Mitigating Evaluator Variance in Multi-Section Courses*:**
   - *Finding:* Without statistical normalization or distribution comparison, evaluator bias accounts for up to 1.2 standard deviation shifts across parallel classrooms.
   - *Application in our work:* Division-wise mean and variance alerts flag grading disparities before final sign-off.

> **Speaker Notes:**  
> "Our literature review demonstrates that existing ERP systems treat colleges like generic enterprises, ignoring statutory academic passing rules, while LMS platforms like Moodle are limited to course content delivery. Our system fills this precise research gap."

---

# 4. Feasibility and Scope

## Slide 10: 4A. Feasibility Study

### 1. Technical Feasibility
* **Modern Stack:** Built on **Node.js (Express)**, **React + Tailwind CSS (Vite)**, and **PostgreSQL**.
* **High Reliability:** Relational schema with ACID compliance ensures student records, foreign keys, and grade ledgers are never left in an inconsistent state.
* **Low Computational Overhead:** Statistical calculations and SGPA computations execute in sub-milliseconds without requiring specialized GPU hardware.

### 2. Operational Feasibility
* **Role-Aligned Ergonomics:** Separate, dedicated interfaces for Student, Faculty, Class Teacher, Project Coordinator, and HOD.
* **Seamless Workflow Adoption:** Faculty can continue using Excel by uploading CSV templates directly into the system, minimizing friction.
* **Human-in-the-Loop Governance:** The HOD retains full authority to approve, reject, or request mark revisions.

### 3. Economic Feasibility
* **100% Open-Source Technologies:** Zero vendor lock-in or recurring per-student software licensing fees (saving thousands of dollars annually).
* **Minimal Infrastructure Footprint:** Operates efficiently on standard campus servers or cloud VPS (2 vCPU, 4GB RAM).

### 4. Legal & Regulatory Feasibility
* **University Alignment:** Fully adheres to SPPU autonomous credit structures and passing ordinances.
* **Data Security & Privacy:** Role-based access control (RBAC), bcrypt-hashed credentials, and session tokens ensure student grades are confidential.

---

## Slide 11: 4B. Scope of the Project — In-Scope Modules

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE IN-SCOPE MODULES                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Autonomous Examination & Result Management                          │
│    • 8 Exam Heads • Term Work Formula • Ordinance 0.4 • SGPA / CGPA    │
├────────────────────────────────────────────────────────────────────────┤
│ 2. BE Project Lifecycle Automation                                     │
│    • Domain Preference Matrix • Guide Allocation • Stage Rubric Review │
├────────────────────────────────────────────────────────────────────────┤
│ 3. TE Seminar Workflow                                                 │
│    • Group/Individual Registration • Stage Approvals • Rubrics Score   │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Attendance Defaulter Triage & Remedial Management                   │
│    • <75% Statutory Detection • Severity Tiers • Action Undertakings   │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Co-Curricular & Department Ecosystem                                │
│    • Student Clubs (CSI, ACM) • Faculty Feedback • E-Newsletter        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Slide 12: 4B. Scope of the Project — System Boundaries (Current Limitations)

### Explicit Boundaries for Stage 1:
* **Academic Scope:** Configured specifically for the Department of Computer Engineering (extensible to other branches in future phases).
* **Data Ingestion Boundary:** Attendance and legacy records are ingested via CSV/Excel sheets and web forms (direct biometric hardware integration is deferred to Phase 2).
* **Financial Boundary:** Does not include online payment gateway processing for revaluation/photocopy fees (focuses purely on academic evaluation and governance).

---

## Slide 13: Future Scope & Roadmap

* **Multi-Department Scale-out:** Extending database schema to support all engineering branches across the institution.
* **Autonomous Agentic AI Integration (LangGraph):** Upgrading rule-based modules to full multi-agent conversational reasoning for student performance diagnosis.
* **Mobile PWA Application:** Developing progressive web app notifications for instant student alerts on attendance thresholds and result publications.
* **Blockchain-Backed Transcripts:** Issuing decentralized verifiable credentials on Ethereum/Polygon testnets for global credential verification.

---

# Slide 14: System Architecture & Workflow Pipeline

```
 [Faculty / Evaluator]
          │
          ▼
 [Data Ingestion & Input Boundary Auditor] ────► Invalid Marks? ──► [Reject & Alert]
          │
          ▼ (Valid Marks)
 [Ordinance 0.4 & Grace Mark Engine]
          │
          ▼
 [Statistical Moderation & Fairness Check] ──► Disparity > 12M? ──► [Flag Warning]
          │
          ▼
 [Academic Progression & ATKT Classifier]
          │
          ▼
 ╔═════════════════════════════════════════════════════════╗
 ║   HUMAN-IN-THE-LOOP (HOD Executive Authorization Gate)  ║
 ╚═════════════════════════════════════════════════════════╝
          │ Approved & Signed
          ▼
 [Cryptographic Notary & Result Publishing]
          │
          ├────────────────────────┬────────────────────────┐
          ▼                        ▼                        ▼
 [Student Portal View]   [Digital QR Grade Card]   [Forensic Audit Log]
```

---

# Slide 15: Current Implementation Status

### Modules Developed & Verified in Phase 1:

1. **Authentication & Security:** JWT authentication with role guards (`student`, `faculty`, `hod`, `coordinator`), bcrypt password hashing, and audit logging.
2. **Database Architecture:** PostgreSQL relational schema with tables for users, students, subjects, marks, attendances, project preferences, and seminars.
3. **Marks Management Module:** Functional draft, submit, verify, approve, and send-back pipelines with CSV upload/download.
4. **Calculations & Grading:** Pure mathematical calculation of Term Work, 10-point SPPU letter grades, SGPA, and cumulative CGPA.
5. **Frontend Application:** Interactive React dashboard for Students, Faculty, and HOD with real-time analytics.

---

# Slide 16: Conclusion & Review Summary

### Summary of Internal Presentation I
* **Problem Addressed:** Replaces error-prone manual spreadsheets with an autonomous, auditable departmental academic platform.
* **Technical Rigor:** Incorporates statutory Ordinance 0.4 condonation, statistical moderation, and role-based security.
* **Scope Confirmed:** Covers Results, BE Projects, TE Seminars, and Attendance Defaulters within a unified, high-performance architecture.
* **Feasibility Validated:** Built on a production-ready open-source stack with zero institutional licensing cost.

---

### Thank You!
**Open for Questions and Suggestions from the Review Panel.**
