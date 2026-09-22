# MES Wadia COE — Autonomous College Result Display System

## Overview
A full-stack academic result management system for MES Wadia COE (Department of Computer Engineering). Supports three roles (Student / Faculty / HOD) with JWT-based auth and role-based access control.

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- PostgreSQL (running locally on port 5432)

### 1. Configure environment
```bash
# Edit .env with your DB credentials
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=college_results
```

### 2. Create database
```sql
CREATE DATABASE college_results;
```

### 3. Start the server (auto-migrates + seeds on first run)
```bash
# From project root
npm start
```

### 4. Start the client (in a separate terminal)
```bash
cd client
npm run dev
```

### 5. Open in browser
```
http://localhost:5173
```

---

## Demo Credentials

| Role    | Login                      | Password     |
|---------|----------------------------|--------------|
| HOD     | hod@meswadiacoe.edu        | hod@123      |
| Faculty | rajan@meswadiacoe.edu      | faculty@123  |
| Faculty | sunita@meswadiacoe.edu     | faculty@123  |
| Faculty | arjun@meswadiacoe.edu      | faculty@123  |
| Student | ce6a001@meswadiacoe.edu    | student@123  |
| Student | ce6a002@meswadiacoe.edu    | student@123  |
| Student | (ce6a001 – ce6a020)        | student@123  |

Students can also log in with their roll number directly (e.g., `CE6A001`).

---

## Project Structure

```
DEPT AUTOMATION/
├── server.js              # Express entry point (auto-migrates + seeds)
├── .env                   # Environment variables
├── db/
│   ├── pool.js            # PostgreSQL connection pool
│   ├── migrate.js         # All table migrations
│   └── seed.js            # Demo data (20 students, 3 faculty, 8 subjects)
├── middleware/
│   ├── auth.js            # JWT verify + requireRole guard
│   └── auditLogger.js     # Audit log utility
├── routes/
│   ├── auth.js            # Login, forgot/reset password
│   ├── student.js         # Student API (results, notifications)
│   ├── faculty.js         # Faculty API (marks entry, submit, CSV upload)
│   └── hod.js             # HOD API (approve, publish, analytics, audit)
├── services/
│   └── gradeCalculator.js # Grade/SGPA/CGPA computation (pure functions)
└── client/                # React + Vite + Tailwind frontend
    └── src/
        ├── pages/
        │   ├── auth/      Login, ForgotPassword
        │   ├── student/   Dashboard, Results, CGPA
        │   ├── faculty/   Dashboard, MarksEntry, Reports, Maintenance
        │   └── hod/       Dashboard, Approval, Publish, Analytics, AuditLog
        ├── components/    Layout, ResultTable, ProtectedRoute
        ├── contexts/      AuthContext (JWT + role)
        └── api/           Axios instance with token interceptor
```

---

## Seed Data

The server auto-seeds on first boot:

- **Department**: Computer Engineering
- **Semesters**: 5 (published) and 6 (mixed statuses)
- **Subjects**:
  - Sem 5: CE501–CE504 (DSA, OS, DBMS, CN)
  - Sem 6: CE601–CE604 (SE, Compiler Design, ML, Web Tech)
- **Marks statuses**: CE601=approved, CE602=submitted, CE603/604=draft

---

## Architecture Notes

- RBAC enforced **server-side** on every route (403 on unauthorized access, not just hidden UI)
- Audit trail on every mark INSERT/UPDATE/DELETE — non-blocking, async
- Published semesters return `423 Locked` on any mark mutation attempt
- Password reset tokens: SHA-256 hashed, 1-hour expiry, single-use
- Grade scale: O(10) / A+(9) / A(8) / B+(7) / B(6) / C(5) / P(4) / F(0)
