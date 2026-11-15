import './config/env.js'; // Validate env vars first
import { env } from './config/env.js';
import { createApp } from './app.js';
import cron from 'node-cron';
import { pruneOldAttempts } from './middleware/rateLimiter.js';
import { runReminderSchedulerTick } from './services/reminderScheduler.js';

const app = createApp();

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n🏥 CareSync API running on http://localhost:${env.PORT}`);
  console.log(`   Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`   Environment: ${env.NODE_ENV}\n`);
});

// ── Background jobs ────────────────────────────────────────────────────────────
// Prune stale rate-limit attempts every hour
cron.schedule('0 * * * *', async () => {
  try {
    await pruneOldAttempts();
  } catch (err) {
    console.error('Rate limit prune failed:', err);
  }
});

// Run medication dose & appointment reminders every minute
cron.schedule('* * * * *', async () => {
  try {
    await runReminderSchedulerTick();
  } catch (err) {
    console.error('Reminder scheduler job error:', err);
  }
});

// Run an initial tick right upon server start to catch up any missed reminders in the last 2 hours
runReminderSchedulerTick().catch((err) => {
  console.error('Initial reminder scheduler tick error:', err);
});

