import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { signToken } from '../utils/jwt.js';
import { PrismaClient, Role, MedicationStatus, EmailReminderType, EmailStatus } from '@prisma/client';
import type { Server } from 'http';
import { addLocalDays, localDateKey, localDateTimeToUtc } from '../utils/timezone.js';

const prisma = new PrismaClient();
const app = createApp();

let server: Server;
let baseUrl: string;
let testProfileId: string;
let elderToken: string;
let caretakerToken: string;
let familyToken: string;

test.before(async () => {
  // 1. Start test server on random port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });

  // 2. Create a dedicated test care profile
  const profile = await prisma.careProfile.create({
    data: {
      name: 'Permissions Test Elder',
      elderPasscodeHash: 'hash1',
      caretakerPasscodeHash: 'hash2',
      familyPasscodeHash: 'hash3',
    },
  });
  testProfileId = profile.id;

  elderToken = signToken({ profileId: testProfileId, role: Role.ELDER });
  caretakerToken = signToken({ profileId: testProfileId, role: Role.CARETAKER });
  familyToken = signToken({ profileId: testProfileId, role: Role.FAMILY });
});

test.after(async () => {
  if (testProfileId) {
    await prisma.careProfile.deleteMany({ where: { id: testProfileId } });
  }
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('Permission Rules Test Suite', async (t) => {
  let createdMedId: string;

  await t.test('1. Caretaker creating a medication sets status to PENDING_APPROVAL', async () => {
    const res = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${caretakerToken}`,
      },
      body: JSON.stringify({
        name: 'Atorvastatin',
        dosage: '20mg',
        instructions: 'Take at night',
        times: ['21:00'],
        stockCount: 30,
        pillsPerDose: 1,
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.medication.status, MedicationStatus.PENDING_APPROVAL);
    assert.equal(body.medication.name, 'Atorvastatin');
    assert.deepEqual(body.medication.times, ['21:00']);
    createdMedId = body.medication.id;

    const storedMedication = await prisma.medication.findUniqueOrThrow({ where: { id: createdMedId } });
    assert.deepEqual(storedMedication.times, ['21:00']);
  });

  await t.test('2. Caretaker CANNOT approve pending medication (Forbidden 403)', async () => {
    const res = await fetch(`${baseUrl}/api/medications/${createdMedId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${caretakerToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.match(body.error, /elder/i);
  });

  await t.test('3. Family role CANNOT create a medication (Forbidden 403)', async () => {
    const res = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyToken}`,
      },
      body: JSON.stringify({
        name: 'Family unauthorized pill',
        dosage: '10mg',
        times: ['10:00'],
        stockCount: 10,
      }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('4. Family role CANNOT create or edit appointments (Forbidden 403)', async () => {
    const res = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyToken}`,
      },
      body: JSON.stringify({
        title: 'Eye Doctor',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('5. Elder CAN approve the pending medication, making it ACTIVE', async () => {
    const res = await fetch(`${baseUrl}/api/medications/${createdMedId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${elderToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.medication.status, MedicationStatus.ACTIVE);
  });

  await t.test('5b. Appointment local input instant is stored as UTC in MySQL', async () => {
    const dateKey = addLocalDays(localDateKey(new Date(), 'Asia/Kolkata'), 1);
    const expectedUtc = localDateTimeToUtc(dateKey, '11:15', 'Asia/Kolkata');
    const response = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${elderToken}` },
      body: JSON.stringify({ title: 'Timezone test visit', scheduledAt: expectedUtc.toISOString() }),
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as any;
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: body.appointment.id } });
    assert.equal(stored.scheduledAt.toISOString(), expectedUtc.toISOString());
  });

  await t.test('6. Dose logging: Elder marks dose TAKEN, stock decrements by pillsPerDose', async () => {
    // 1. Get today's doses
    const getRes = await fetch(`${baseUrl}/api/doses/today`, {
      headers: { Authorization: `Bearer ${elderToken}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as any;
    const dose = getBody.doses.find((d: any) => d.medicationId === createdMedId);
    assert.ok(dose, 'Dose should exist for today');
    assert.equal(dose.scheduledAt, localDateTimeToUtc(getBody.date, '21:00', 'Asia/Kolkata').toISOString());

    // 2. Mark TAKEN
    const postRes = await fetch(`${baseUrl}/api/doses/${dose.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${elderToken}`,
      },
      body: JSON.stringify({ status: 'TAKEN' }),
    });

    assert.equal(postRes.status, 200);
    const postBody = (await postRes.json()) as any;
    assert.equal(postBody.dose.status, 'TAKEN');
    assert.equal(postBody.remainingStock, 29); // 30 - 1 = 29
  });

  await t.test('6b. Undoing TAKEN restores stock and schedule JSON is returned', async () => {
    const getRes = await fetch(`${baseUrl}/api/doses/today`, {
      headers: { Authorization: `Bearer ${elderToken}` },
    });
    const getBody = (await getRes.json()) as any;
    const dose = getBody.doses.find((d: any) => d.medicationId === createdMedId);

    const postRes = await fetch(`${baseUrl}/api/doses/${dose.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${elderToken}`,
      },
      body: JSON.stringify({ status: 'PENDING' }),
    });

    assert.equal(postRes.status, 200);
    const postBody = (await postRes.json()) as any;
    assert.equal(postBody.dose.status, 'PENDING');
    assert.equal(postBody.remainingStock, 30);
    assert.deepEqual(postBody.dose.medication.times, ['21:00']);
  });

  await t.test('6c. EmailLog composite unique constraint blocks a duplicate', async () => {
    const entry = {
      profileId: testProfileId,
      entityId: createdMedId,
      entityType: 'Medication',
      reminderType: EmailReminderType.DOSE_UPCOMING,
      recipient: 'constraint-test@example.invalid',
      subject: 'Constraint verification',
      body: 'Temporary database integration check.',
      status: EmailStatus.SIMULATED,
      sentAt: new Date('2026-11-15T02:30:00.000Z'),
    };
    const created = await prisma.emailLog.create({ data: entry });
    assert.equal(created.sentAt.toISOString(), '2026-11-15T02:30:00.000Z');
    await assert.rejects(
      prisma.emailLog.create({ data: entry }),
      (error: any) => error?.code === 'P2002',
    );
  });

  await t.test('7. Family role CANNOT mark dose status (Forbidden 403)', async () => {
    // Get today's doses
    const getRes = await fetch(`${baseUrl}/api/doses/today`, {
      headers: { Authorization: `Bearer ${familyToken}` },
    });
    const getBody = (await getRes.json()) as any;
    const dose = getBody.doses[0];

    const postRes = await fetch(`${baseUrl}/api/doses/${dose.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyToken}`,
      },
      body: JSON.stringify({ status: 'SKIPPED' }),
    });

    assert.equal(postRes.status, 403);
  });
});

