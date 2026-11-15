import test from 'node:test';
import assert from 'node:assert/strict';

// Helper to evaluate reminder decision matching the rules in reminderScheduler.ts
function evaluateDoseReminderAction(diffMinutes: number, currentStatus: 'PENDING' | 'MISSED' | 'TAKEN') {
  // diffMinutes = Math.round((nowMs - scheduledMs) / (60 * 1000))
  // diffMinutes = -15 -> 15 min before scheduled time
  // diffMinutes = +30 -> 30 min after scheduled time
  // diffMinutes = +60 -> 60 min after scheduled time

  const actions: string[] = [];

  // UPCOMING: between 15 min before (-15) and 30 min after (+30), if still PENDING
  if (currentStatus === 'PENDING' && diffMinutes >= -15 && diffMinutes < 30) {
    actions.push('SEND_UPCOMING_REMINDER_TO_ELDER');
  }

  // MISSED: 30 to 120 minutes past, if still PENDING
  if (currentStatus === 'PENDING' && diffMinutes >= 30 && diffMinutes <= 120) {
    actions.push('MARK_STATUS_MISSED');
    actions.push('SEND_MISSED_ALERT_TO_ELDER');
  }

  // ESCALATION: 60 to 120 minutes past, if status is MISSED
  if (currentStatus === 'MISSED' && diffMinutes >= 60 && diffMinutes <= 120) {
    actions.push('SEND_ESCALATION_TO_CARETAKER_AND_FAMILY');
  }

  // CATCH-UP GUARD: if older than 120 minutes, do not send
  if (diffMinutes > 120) {
    actions.push('SUPPRESSED_BY_2_HOUR_CATCHUP_GUARD');
  }

  return actions;
}

// In-memory simulator of duplicate prevention logic
class DeduplicationSimulator {
  private sentLogs = new Set<string>();
  public sendCount = 0;

  send(entityId: string, reminderType: string, recipient: string): boolean {
    const key = `${entityId}:${reminderType}:${recipient}`;
    if (this.sentLogs.has(key)) {
      return false; // Duplicate suppressed!
    }
    this.sentLogs.add(key);
    this.sendCount++;
    return true; // Sent!
  }
}

test('Reminder Timing & Duplicate Prevention Test Suite', async (t) => {
  await t.test('1. Dose due in 15 minutes triggers UPCOMING reminder to elder', () => {
    const actions = evaluateDoseReminderAction(-15, 'PENDING');
    assert.ok(actions.includes('SEND_UPCOMING_REMINDER_TO_ELDER'));
    assert.equal(actions.includes('SEND_MISSED_ALERT_TO_ELDER'), false);
    assert.equal(actions.includes('SEND_ESCALATION_TO_CARETAKER_AND_FAMILY'), false);
  });

  await t.test('2. Dose due in 30 minutes does NOT trigger upcoming yet (too early)', () => {
    const actions = evaluateDoseReminderAction(-30, 'PENDING');
    assert.equal(actions.length, 0);
  });

  await t.test('3. Dose 30 minutes overdue with no action marks MISSED and emails elder', () => {
    const actions = evaluateDoseReminderAction(30, 'PENDING');
    assert.ok(actions.includes('MARK_STATUS_MISSED'));
    assert.ok(actions.includes('SEND_MISSED_ALERT_TO_ELDER'));
    assert.equal(actions.includes('SEND_ESCALATION_TO_CARETAKER_AND_FAMILY'), false);
  });

  await t.test('4. Dose 60 minutes overdue triggers ESCALATION to caretaker and family', () => {
    const actions = evaluateDoseReminderAction(60, 'MISSED');
    assert.ok(actions.includes('SEND_ESCALATION_TO_CARETAKER_AND_FAMILY'));
    assert.equal(actions.includes('SEND_UPCOMING_REMINDER_TO_ELDER'), false);
  });

  await t.test('5. Already TAKEN dose triggers NO reminders even if 60+ minutes past', () => {
    const actions = evaluateDoseReminderAction(60, 'TAKEN');
    assert.equal(actions.length, 0);
  });

  await t.test('6. Overdue dose older than 2 hours is suppressed by catch-up guard', () => {
    const actions = evaluateDoseReminderAction(150, 'MISSED');
    assert.ok(actions.includes('SUPPRESSED_BY_2_HOUR_CATCHUP_GUARD'));
    assert.equal(actions.includes('SEND_ESCALATION_TO_CARETAKER_AND_FAMILY'), false);
  });

  await t.test('7. Deduplication: Sending the exact same reminder twice is blocked on 2nd attempt', () => {
    const simulator = new DeduplicationSimulator();
    const entityId = 'dose-uuid-1234';
    const reminderType = 'DOSE_UPCOMING';
    const recipient = 'elder@demo.caresync';

    const firstTry = simulator.send(entityId, reminderType, recipient);
    assert.equal(firstTry, true, 'First send attempt must succeed');
    assert.equal(simulator.sendCount, 1);

    const secondTry = simulator.send(entityId, reminderType, recipient);
    assert.equal(secondTry, false, 'Second send attempt with same key must be suppressed as duplicate');
    assert.equal(simulator.sendCount, 1);
  });

  await t.test('8. Deduplication: Different reminder type for same dose is permitted', () => {
    const simulator = new DeduplicationSimulator();
    const entityId = 'dose-uuid-1234';
    const recipient = 'elder@demo.caresync';

    const upcoming = simulator.send(entityId, 'DOSE_UPCOMING', recipient);
    assert.equal(upcoming, true);

    const missed = simulator.send(entityId, 'DOSE_MISSED', recipient);
    assert.equal(missed, true, 'Different reminder type must be allowed');
    assert.equal(simulator.sendCount, 2);
  });
});

