import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { signToken } from '../utils/jwt.js';
import { PrismaClient, Role, MedicationStatus } from '@prisma/client';
import type { Server } from 'http';

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
    createdMedId = body.medication.id;
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

  await t.test('6. Dose logging: Elder marks dose TAKEN, stock decrements by pillsPerDose', async () => {
    // 1. Get today's doses
    const getRes = await fetch(`${baseUrl}/api/doses/today`, {
      headers: { Authorization: `Bearer ${elderToken}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as any;
    const dose = getBody.doses.find((d: any) => d.medicationId === createdMedId);
    assert.ok(dose, 'Dose should exist for today');

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

