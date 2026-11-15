# CareSync demo script (3 minutes)

## 0:00–0:35 — Elder-centred approval

1. Open **Medicines** as the Caretaker and propose a new medicine schedule.
2. Switch to the Elder account, review the pending proposal, and approve it.
3. Point out that the schedule becomes active only after the Elder confirms it; the Family account can see the schedule but has no write controls.

## 0:35–1:15 — Reminder escalation

Before presenting, set `DEMO_MODE=true` in `server/.env`, restart the server, and create/select a dose scheduled about 15 minutes after the demo clock’s displayed time. As the Elder, advance the clock by **+15m**, then **+30m**, then **+60m Escalation**. Show the missed and escalation records in the Today and Email Log screens. The clock advances the scheduler; it does not alter reminder rules.

## 1:15–2:05 — Prescription photo draft

On **Medicines**, upload a JPG or PNG prescription image under 5 MB. Review the extracted medicine name, dose, frequency, timing, and instructions. Edit any field that needs correction, read the “AI-extracted, please verify against your prescription” notice, and confirm the draft. If logged in as Caretaker, switch to Elder and approve the resulting proposal.

## 2:05–2:45 — Doctor summary

Open **Summary**, choose the date range, and review the exact adherence figures, missed doses, observed patterns, refill status, and appointments. Select **Generate plain-language summary** and show that the generated paragraph is labelled and displayed beside the underlying figures. Use **Print** to show the clinician-friendly layout.

## 2:45–3:00 — Safety close

“CareSync keeps the elder in control: AI suggestions need human review, the audit log records changes, and reminders continue to work without AI. CareSync does not diagnose or give medical advice.”

If using a clean demo database, run `npm run demo:reset` before the presentation. This clears and reseeds the configured database.
