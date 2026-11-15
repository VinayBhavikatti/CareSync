import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PrismaClient, Role, AppointmentStatus, AuditActor } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createAuditEntry } from '../services/auditService.js';

const router = Router();
const prisma = new PrismaClient();

const appointmentSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(100),
  doctorName: z.string().max(100).optional().nullable(),
  location: z.string().max(150).optional().nullable(),
  scheduledAt: z.string().datetime('Valid scheduled date/time is required (ISO 8601).'),
  notes: z.string().max(500).optional().nullable(),
  status: z.nativeEnum(AppointmentStatus).optional().default(AppointmentStatus.UPCOMING),
});

router.use(authenticate);

// ── GET /api/appointments ────────────────────────────────────────────────────
// All authenticated roles (ELDER, CARETAKER, FAMILY) can view appointments
router.get('/', async (req: Request, res: Response) => {
  const { profileId, role } = req.user!;

  const appointments = await prisma.appointment.findMany({
    where: { profileId },
    orderBy: { scheduledAt: 'asc' },
  });

  res.json({
    appointments,
    canEdit: role === Role.ELDER || role === Role.CARETAKER,
  });
});

// ── POST /api/appointments ───────────────────────────────────────────────────
// ELDER and CARETAKER can create appointments. FAMILY is rejected.
router.post('/', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { profileId, role } = req.user!;
  const data = parsed.data;

  const appointment = await prisma.appointment.create({
    data: {
      profileId,
      title: data.title,
      doctorName: data.doctorName ?? null,
      location: data.location ?? null,
      scheduledAt: new Date(data.scheduledAt),
      notes: data.notes ?? null,
      status: data.status,
    },
  });

  await createAuditEntry({
    profileId,
    actor: role as unknown as AuditActor,
    action: 'APPOINTMENT_CREATED',
    entityType: 'Appointment',
    entityId: appointment.id,
    after: appointment,
  });

  res.status(201).json({
    appointment,
    message: 'Appointment added successfully.',
  });
});

// ── PUT /api/appointments/:id ────────────────────────────────────────────────
// ELDER and CARETAKER can edit appointments. FAMILY is rejected.
router.put('/:id', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId, role } = req.user!;

  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const data = parsed.data;

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      title: data.title,
      doctorName: data.doctorName ?? null,
      location: data.location ?? null,
      scheduledAt: new Date(data.scheduledAt),
      notes: data.notes ?? null,
      status: data.status,
    },
  });

  await createAuditEntry({
    profileId,
    actor: role as unknown as AuditActor,
    action: 'APPOINTMENT_UPDATED',
    entityType: 'Appointment',
    entityId: id,
    before: existing,
    after: updated,
  });

  res.json({
    appointment: updated,
    message: 'Appointment updated successfully.',
  });
});

// ── DELETE /api/appointments/:id ─────────────────────────────────────────────
// ELDER and CARETAKER can delete appointments. FAMILY is rejected.
router.delete('/:id', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId, role } = req.user!;

  const existing = await prisma.appointment.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  await prisma.appointment.delete({
    where: { id },
  });

  await createAuditEntry({
    profileId,
    actor: role as unknown as AuditActor,
    action: 'APPOINTMENT_DELETED',
    entityType: 'Appointment',
    entityId: id,
    before: existing,
  });

  res.json({ message: 'Appointment deleted.' });
});

export default router;
