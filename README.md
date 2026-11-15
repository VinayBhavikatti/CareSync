# Kindred 🏥❤️
*(Repository: [CareSync](https://github.com/VinayBhavikatti/CareSync))*

> **Shared elder care and medication management platform with the elderly person at the center of their own healthcare decisions.**

---

## 📌 The Problem

Managing chronic conditions, medications, and clinic appointments is stressful and confusing for elderly individuals. Family members and caretakers want to assist, but often unintentionally take away the elder's agency or lack real-time visibility into whether crucial doses were taken. Traditional medication apps are either basic alarm clocks or complex portals that require passwords and treat elderly users as passive patients.

**Kindred** solves this by:
1. **Keeping the elder in full control:** Caretakers can propose medications and updates, but they do **not** take effect on the daily schedule until the elder explicitly approves them.
2. **Eliminating password friction:** Accessible, role-based passcodes (Elder, Caretaker, Family) without complicated email/password sign-up flows.
3. **Closing the communication loop:** Automated background scheduling alerts the elder before a dose, sends a check-in alert if missed, escalates to family/caretakers after 60 minutes, and broadcasts an immediate "All Clear" notice once taken.
4. **Accessible UX:** High-contrast design, minimum 18px typography, giant 48px+ tap targets, dark mode, and an unmistakable one-tap *"✓ I took it"* button.

---

## ✨ Features Built So Far

- **Passcode Authentication & Rate-Limiting:**
  - Dedicated bcrypt-hashed passcodes for 3 distinct roles:
    - 👴 **Elder**: Full control; approves or declines proposed changes.
    - 🧑‍⚕️ **Caretaker**: Can add medicines, schedule visits, and log doses (requires elder approval for prescription changes).
    - 👨‍👩‍👧 **Family**: View-only transparency into adherence and schedules.
  - 5-attempt rate-limiting with 15-minute lockout to safeguard households.
  - 8-hour JWT sessions with automatic resume.
- **Medication Schedule & Caretaker Approval Workflow:**
  - Full CRUD with dosages, daily timings (24-hour format), and stock counts.
  - Caretaker-submitted medications and edits are saved as `PENDING` and prominently displayed in an **"Awaiting Approval"** banner until reviewed by the elder.
  - Elders can **Approve** or **Decline** with one click.
- **One-Tap Dose Logging ("I took it"):**
  - Today's schedule automatically generated for active medications in the elder's timezone.
  - Giant green *"✓ I took it"* and *"Skip"* buttons with status indicated via both text/icon and color (`✅ TAKEN`, `⏳ DUE`, `⏭️ SKIPPED`, `⚠️ MISSED`).
  - Marking a dose taken automatically decrements remaining pill stock in an atomic database transaction (undoing restores stock).
- **Appointments Management:**
  - Track doctor consultations, clinics, timings, and prep instructions.
  - Shared visibility across elder, caretaker, and family.
- **Automated Email Reminders & Escalation (`node-cron`):**
  - **15 min before dose (`UPCOMING`)**: Friendly reminder emailed to the elder.
  - **30 min after dose (`MISSED`)**: Alert emailed to elder checking if they took it.
  - **60 min after dose (`ESCALATION`)**: Urgent escalation emailed to family & caretakers.
  - **All-Clear Notice (`ALL CLEAR`)**: Immediate follow-up email to all parties once an overdue dose is taken.
  - **Appointments**: Reminders sent 24 hours and 2 hours before visits.
  - **Caretaker Proposals**: Elder is emailed whenever a caretaker submits a change for review.
  - **Reliability & Idempotency**: `EmailLog` database constraint prevents duplicate emails; automatic retry with exponential backoff; 2-hour window catch-up on server restarts.
  - **SMTP / Safe Simulation**: Works with any SMTP provider (Mailtrap, Resend) or runs in zero-setup simulation mode logging to console and DB.
- **Demo Clock Fast-Forward (Judging Mode):**
  - Elder-accessible time travel controls (`+15m`, `+30m`, `🚨 +60m Escalation`, `↺ Reset`) enabled when `DEMO_MODE=true` to demonstrate full multi-hour reminder cycles in under 2 minutes.
- **Activity & Email Logs:**
  - Tamper-proof audit trail of who did what and when.
  - Searchable email notification history screen.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, TypeScript, React Router 6
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** PostgreSQL
- **Scheduling:** `node-cron`
- **Email:** Nodemailer (SMTP with fallback to database simulation log)
- **Security:** bcrypt (12 rounds), JWT, Helmet, CORS, Zod validation

---

## 📋 Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **PostgreSQL** running locally or a cloud database URL (Neon, Supabase, Railway)

---

## 🚀 Step-by-Step Setup

### 1. Clone & Install
```bash
git clone https://github.com/VinayBhavikatti/CareSync.git
cd CareSync
npm install
```

### 2. Configure Environment Variables
Create the server environment file:
```bash
cp .env.example server/.env
```
Open `server/.env` and update:
- `DATABASE_URL`: Your PostgreSQL connection string (e.g., `postgresql://postgres:password@localhost:5432/kindred`).
- `JWT_SECRET`: Random string with at least 32 characters.
- *(Optional)* SMTP settings (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`). If left empty, emails will log to the console and database.

Create the client environment file:
```bash
# In client/.env.local:
VITE_API_URL=http://localhost:3001
```

### 3. Initialize & Seed Database
```bash
# Push Prisma schema to PostgreSQL
npm run db:push

# Populate demo profile, medications, and appointments
npm run db:seed
```
*The seed command prints the generated Profile ID and test passcodes.*

### 4. Run Development Servers
```bash
npm run dev
```
- **Frontend App:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/api/health

---

## 🔑 Demo Credentials (from Seed)

| Role | Access Level | Demo Passcode |
|------|-------------|---------------|
| 👴 **Elder** | Full control & change approval | `kindred-elder` |
| 🧑‍⚕️ **Caretaker** | Propose medicines & log doses | `kindred-care` |
| 👨‍👩‍👧 **Family** | Read-only updates | `kindred-fam` |

*(Use the **Profile ID** printed in the console during `npm run db:seed` on the login screen).*

---

## 🧪 Running Tests

```bash
# Run unit tests (permission gates, timing rules, duplicate prevention)
npm test
```
*All 17 tests run in sub-second time without external dependencies.*

---

## 🗺️ Planned Next Phases

- **Phase 4 — Adherence Insights & Refill Predictor:**
  - 7-day and 30-day percentage adherence calculations.
  - Pattern detection (e.g., morning vs evening miss rates).
  - Predictive pill exhaustion forecasts based on actual consumption rates.
- **Phase 5 — Optional AI Enhancements (with Graceful Fallbacks):**
  - Multimodal prescription label / photo reader to draft schedules (human confirmation always required).
  - Plain-language and multilingual reminder message generation (English, Hindi, Kannada).
  - Doctor visit summary generator.
  - Credit-guarding with strict daily caps, caching, and template fallbacks.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
