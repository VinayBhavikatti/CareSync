import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';
import type { Server } from 'http';

test('Middleware Permission Gate Unit Tests (Database-independent)', async (t) => {
  const app = express();
  app.use(express.json());

  // Test endpoints simulating role-guarded actions
  app.post(
    '/test/elder-only',
    (req, _res, next) => {
      req.user = req.body.simulatedUser;
      next();
    },
    requireRole(Role.ELDER),
    (_req, res) => {
      res.json({ success: true });
    },
  );

  app.post(
    '/test/elder-or-caretaker',
    (req, _res, next) => {
      req.user = req.body.simulatedUser;
      next();
    },
    requireRole(Role.ELDER, Role.CARETAKER),
    (_req, res) => {
      res.json({ success: true });
    },
  );

  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });

  t.after(() => {
    server.close();
  });

  await t.test('1. Caretaker is rejected on Elder-only endpoint (e.g. approve/decline)', async () => {
    const res = await fetch(`${baseUrl}/test/elder-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedUser: { profileId: '123', role: Role.CARETAKER },
      }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.match(body.error, /elder/i);
  });

  await t.test('2. Family is rejected on Elder-only endpoint', async () => {
    const res = await fetch(`${baseUrl}/test/elder-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedUser: { profileId: '123', role: Role.FAMILY },
      }),
    });
    assert.equal(res.status, 403);
  });

  await t.test('3. Elder succeeds on Elder-only endpoint', async () => {
    const res = await fetch(`${baseUrl}/test/elder-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedUser: { profileId: '123', role: Role.ELDER },
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
  });

  await t.test('4. Family is rejected on write endpoint (Elder or Caretaker)', async () => {
    const res = await fetch(`${baseUrl}/test/elder-or-caretaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedUser: { profileId: '123', role: Role.FAMILY },
      }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.match(body.error, /elder or caretaker/i);
  });

  await t.test('5. Caretaker succeeds on Elder or Caretaker endpoint', async () => {
    const res = await fetch(`${baseUrl}/test/elder-or-caretaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedUser: { profileId: '123', role: Role.CARETAKER },
      }),
    });
    assert.equal(res.status, 200);
  });

  await t.test('6. Elder succeeds on Elder or Caretaker endpoint', async () => {
    const res = await fetch(`${baseUrl}/test/elder-or-caretaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedUser: { profileId: '123', role: Role.ELDER },
      }),
    });
    assert.equal(res.status, 200);
  });

  await t.test('7. Unauthenticated request is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/test/elder-or-caretaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
  });
});

