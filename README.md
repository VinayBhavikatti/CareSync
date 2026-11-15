# CareSync

CareSync is a shared elder care and medication management platform. It helps an elder, their caretaker, and their family coordinate medication schedules, appointments, adherence, and reminders while keeping the elder in control of medicine changes.

## The problem

Medication routines can be difficult to coordinate across a household. Caretakers need a way to help, elders need control over their care, and family members need visibility. CareSync gives each role clear permissions and keeps reminders reliable even when optional AI services are unavailable.

## Features

- Passcode sign-in with Elder, Caretaker, and read-only Family roles.
- Medication schedules, stock tracking, dose logging, and elder approval for caretaker proposals.
- Appointment tracking and a role-aware audit log of recorded changes.
- Email reminders, missed-dose escalation, all-clear notices, and a simulated email log when SMTP is not configured.
- Adherence insights, deterministic patterns, refill estimates, and a printable care summary.
- Optional AI prescription photo extraction and a plain-language doctor summary. Extracted data always requires human review and confirmation.
- Reviewed English, Hindi, and Kannada reminder templates.
- Accessible high-contrast screens, keyboard focus indicators, large tap targets, and text alternatives for charts.

**Reminders never depend on AI.** The scheduler uses fixed rules and reviewed message templates; an AI failure cannot block or delay a reminder.

## Architecture

- `client/`: React, Vite, TypeScript, Tailwind CSS, React Router.
- `server/`: Node.js, Express, TypeScript, Prisma, Zod, JWT, bcrypt, Nodemailer, and node-cron.
- MySQL is the application database. Prisma stores schedule times as JSON and stores date/time values as UTC instants in `DATETIME(3)` columns.
- AI providers run on the server behind a provider interface. The Adaption Labs key is read from `server/.env` only.

## Setup

Requirements: Node.js 18+, npm 9+, and MySQL 5.7.8+.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local database:

   ```sql
   CREATE DATABASE kindred CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Copy `.env.example` to `server/.env` and set `DATABASE_URL`:

   ```text
   mysql://USER:PASSWORD@localhost:3306/kindred
   ```

   URL-encode reserved characters in the username or password (for example, `@` as `%40`, `:` as `%3A`, `/` as `%2F`, and `#` as `%23`). Keep secrets in `server/.env`, never in tracked files. Set a random `JWT_SECRET` of at least 32 characters. SMTP and AI credentials are optional.

4. Push the Prisma schema and load demo data:

   ```bash
   npm run db:push
   npm run db:seed
   npm run db:seed:history
   ```

5. Start the client and server:

   ```bash
   npm run dev
   ```

   The client is at `http://localhost:5173`; the API is at `http://localhost:3001`.

### Demo accounts

After seeding, use the Profile ID printed by the seed command and one of these demo-only passcodes:

| Role | Passcode | Access |
|---|---|---|
| Elder | `caresync-elder` | Full control and approval |
| Caretaker | `caresync-care` | Add/edit and log doses; changes require elder approval |
| Family | `caresync-fam` | Read-only |

Enable the demo clock in `server/.env` with `DEMO_MODE=true` for the escalation walkthrough. It is disabled by default in `.env.example`.

`npm run demo:reset` drops and recreates the configured database schema, then seeds the demo profile, medicines, appointment, and 30 days of history. **This clears all data in the configured database.**

## Tests and production build

```bash
npm test
npm run build
```

The suite includes unit coverage for adherence, refill math, AI validation/fallbacks, permission middleware, MySQL-backed role permissions, the EmailLog duplicate constraint, schedule JSON round-tripping, and dose stock decrement/undo.

To check optional Adaption Labs access, set `ADAPTION_API_KEY` in `server/.env` and run `npm run ai:test`. The smoke test makes one small text request and one small image request.

## Safety design

- AI output is a draft. A person reviews and confirms every extracted prescription field before anything is saved; caretaker changes still follow elder approval.
- AI must only restate supplied data. It does not diagnose or provide dosage advice. The care summary keeps exact figures visible beside any generated paragraph.
- No medical advice is provided by CareSync. Users should discuss care decisions with their clinician.
- Reminder timing and delivery do not use AI.
- The audit log records who changed what and when. Access is controlled by backend role middleware.
- Secrets stay in environment files and are not logged. Prescription images are validated and processed without being retained.
