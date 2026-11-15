import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma, Role, MedicationStatus, ProposalStatus, AuditActor } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createAuditEntry } from '../services/auditService.js';
import { sendProposalNeedsApprovalEmail } from '../services/reminderScheduler.js';
import { decodeMedicationTimes, encodeMedicationTimes } from '../utils/medicationTimes.js';

const router = Router();
const prisma = new PrismaClient();

function medicationForApi(medication: any) {
  return { ...medication, times: decodeMedicationTimes(medication.times as Prisma.JsonValue) };
}

function proposalForApi(proposal: any) {
  const changes = proposal.proposedChanges as Record<string, unknown>;
  return {
    ...proposal,
    medication: medicationForApi(proposal.medication),
    proposedChanges: changes?.times
      ? { ...changes, times: decodeMedicationTimes(changes.times as Prisma.JsonValue) }
      : changes,
  };
}

// Schema for adding or updating medication
const medicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required.').max(100),
  dosage: z.string().min(1, 'Dosage is required (e.g., 500mg, 1 tablet).').max(50),
  instructions: z.string().max(255).optional().nullable(),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Each time must be in HH:mm 24-hour format.')).min(1, 'At least one time per day is required.'),
  stockCount: z.number().int().min(0, 'Stock count cannot be negative.'),
  pillsPerDose: z.number().int().min(1, 'Must be at least 1 per dose.').default(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
});

// All routes require authentication
router.use(authenticate);

// ── GET /api/medications ─────────────────────────────────────────────────────
// All authenticated roles (ELDER, CARETAKER, FAMILY) can view medications
router.get('/', async (req: Request, res: Response) => {
  const { profileId, role } = req.user!;

  const [activeMeds, pendingMeds, pendingProposals] = await Promise.all([
    prisma.medication.findMany({
      where: {
        profileId,
        status: MedicationStatus.ACTIVE,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.medication.findMany({
      where: {
        profileId,
        status: MedicationStatus.PENDING_APPROVAL,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.medicationChangeProposal.findMany({
      where: {
        profileId,
        status: ProposalStatus.PENDING,
      },
      include: {
        medication: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({
    active: activeMeds.map(medicationForApi),
    pendingNew: pendingMeds.map(medicationForApi),
    pendingChanges: pendingProposals.map(proposalForApi),
    canApprove: role === Role.ELDER,
    canEdit: role === Role.ELDER || role === Role.CARETAKER,
  });
});

// ── POST /api/medications ────────────────────────────────────────────────────
// Only ELDER and CARETAKER can add medicines. FAMILY is rejected.
router.post('/', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const parsed = medicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { profileId, role } = req.user!;
  const data = parsed.data;

  // If ELDER adds: directly ACTIVE.
  // If CARETAKER adds: PENDING_APPROVAL until Elder approves.
  const isElder = role === Role.ELDER;
  const status = isElder ? MedicationStatus.ACTIVE : MedicationStatus.PENDING_APPROVAL;

  const medication = await prisma.medication.create({
    data: {
      profileId,
      name: data.name,
      dosage: data.dosage,
      instructions: data.instructions ?? null,
      times: encodeMedicationTimes(data.times),
      stockCount: data.stockCount,
      pillsPerDose: data.pillsPerDose,
      status,
      proposedBy: role,
      approvedAt: isElder ? new Date() : null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });

  await createAuditEntry({
    profileId,
    actor: role as unknown as AuditActor,
    action: isElder ? 'MEDICATION_CREATED' : 'MEDICATION_PROPOSED_BY_CARETAKER',
    entityType: 'Medication',
    entityId: medication.id,
    after: medication,
  });

  if (!isElder) {
    sendProposalNeedsApprovalEmail(profileId, medication.id, medication.name).catch((err) =>
      console.error('Failed to dispatch proposal email:', err),
    );
  }

  res.status(201).json({
    medication: medicationForApi(medication),
    message: isElder
      ? 'Medication added successfully.'
      : 'Medication proposed! It will appear on the schedule once the elder approves it.',
  });
});

// ── PUT /api/medications/:id ─────────────────────────────────────────────────
// Only ELDER and CARETAKER can edit. FAMILY is rejected.
router.put('/:id', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId, role } = req.user!;

  const parsed = medicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const existing = await prisma.medication.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Medication not found.' });
    return;
  }

  const data = parsed.data;

  if (role === Role.ELDER) {
    // Elder updates directly
    const updated = await prisma.medication.update({
      where: { id },
      data: {
        name: data.name,
        dosage: data.dosage,
        instructions: data.instructions ?? null,
        times: encodeMedicationTimes(data.times),
        stockCount: data.stockCount,
        ...((data.stockCount > existing.stockCount) ? { refillCycle: ((existing as any).refillCycle ?? 0) + 1 } : {}),
        pillsPerDose: data.pillsPerDose,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      },
    });

    await createAuditEntry({
      profileId,
      actor: AuditActor.ELDER,
      action: 'MEDICATION_UPDATED',
      entityType: 'Medication',
      entityId: id,
      before: existing,
      after: updated,
    });

    res.json({ medication: medicationForApi(updated), message: 'Medication updated successfully.' });
    return;
  }

  // Caretaker proposes edits -> MedicationChangeProposal
  const proposal = await prisma.medicationChangeProposal.create({
    data: {
      profileId,
      medicationId: id,
      proposedChanges: { ...data, times: encodeMedicationTimes(data.times) },
      status: ProposalStatus.PENDING,
    },
  });

  await createAuditEntry({
    profileId,
    actor: AuditActor.CARETAKER,
    action: 'MEDICATION_UPDATE_PROPOSED',
    entityType: 'MedicationChangeProposal',
    entityId: proposal.id,
    before: existing,
    after: data,
  });

  sendProposalNeedsApprovalEmail(profileId, proposal.id, data.name).catch((err) =>
    console.error('Failed to dispatch proposal update email:', err),
  );

  res.json({
    proposal: proposalForApi({ ...proposal, medication: existing }),
    message: 'Changes submitted for elder approval.',
  });
});

// ── DELETE /api/medications/:id ──────────────────────────────────────────────
// Only ELDER can delete/archive medications.
router.delete('/:id', requireRole(Role.ELDER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId } = req.user!;

  const existing = await prisma.medication.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Medication not found.' });
    return;
  }

  await prisma.medication.update({
    where: { id },
    data: { status: MedicationStatus.ARCHIVED },
  });

  await createAuditEntry({
    profileId,
    actor: AuditActor.ELDER,
    action: 'MEDICATION_ARCHIVED',
    entityType: 'Medication',
    entityId: id,
    before: existing,
  });

  res.json({ message: 'Medication archived.' });
});

// ── POST /api/medications/:id/approve ────────────────────────────────────────
// Elder approves a new pending medication OR a pending change proposal
router.post('/:id/approve', requireRole(Role.ELDER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId } = req.user!;
  const { proposalId } = req.body; // Optional: if approving a change proposal

  if (proposalId) {
    const proposal = await prisma.medicationChangeProposal.findFirst({
      where: { id: proposalId, profileId, status: ProposalStatus.PENDING },
      include: { medication: true },
    });

    if (!proposal) {
      res.status(404).json({ error: 'Pending change proposal not found.' });
      return;
    }

    const changes = proposal.proposedChanges as any;

    const [updatedMed] = await prisma.$transaction([
      prisma.medication.update({
        where: { id: proposal.medicationId },
        data: {
          name: changes.name ?? proposal.medication.name,
          dosage: changes.dosage ?? proposal.medication.dosage,
          instructions: changes.instructions !== undefined ? changes.instructions : proposal.medication.instructions,
          times: changes.times
            ? encodeMedicationTimes(decodeMedicationTimes(changes.times))
            : encodeMedicationTimes(decodeMedicationTimes(proposal.medication.times)),
          stockCount: changes.stockCount ?? proposal.medication.stockCount,
          ...((changes.stockCount ?? proposal.medication.stockCount) > proposal.medication.stockCount ? { refillCycle: ((proposal.medication as any).refillCycle ?? 0) + 1 } : {}),
          pillsPerDose: changes.pillsPerDose ?? proposal.medication.pillsPerDose,
        },
      }),
      prisma.medicationChangeProposal.update({
        where: { id: proposalId },
        data: { status: ProposalStatus.APPROVED, decidedAt: new Date() },
      }),
    ]);

    await createAuditEntry({
      profileId,
      actor: AuditActor.ELDER,
      action: 'MEDICATION_CHANGE_APPROVED',
      entityType: 'Medication',
      entityId: proposal.medicationId,
      before: proposal.medication,
      after: updatedMed,
    });

    res.json({ message: 'Changes approved and applied to medication.', medication: medicationForApi(updatedMed) });
    return;
  }

  // Approving a new pending medication
  const pendingMed = await prisma.medication.findFirst({
    where: { id, profileId, status: MedicationStatus.PENDING_APPROVAL },
  });

  if (!pendingMed) {
    res.status(404).json({ error: 'Pending medication not found.' });
    return;
  }

  const approvedMed = await prisma.medication.update({
    where: { id },
    data: {
      status: MedicationStatus.ACTIVE,
      approvedAt: new Date(),
    },
  });

  await createAuditEntry({
    profileId,
    actor: AuditActor.ELDER,
    action: 'MEDICATION_PROPOSAL_APPROVED',
    entityType: 'Medication',
    entityId: id,
    before: pendingMed,
    after: approvedMed,
  });

  res.json({ message: 'Medication approved and added to your schedule.', medication: medicationForApi(approvedMed) });
});

// ── POST /api/medications/:id/decline ────────────────────────────────────────
// Elder declines a pending medication OR a pending change proposal
router.post('/:id/decline', requireRole(Role.ELDER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId } = req.user!;
  const { proposalId, reason } = req.body;

  if (proposalId) {
    const proposal = await prisma.medicationChangeProposal.findFirst({
      where: { id: proposalId, profileId, status: ProposalStatus.PENDING },
    });

    if (!proposal) {
      res.status(404).json({ error: 'Pending proposal not found.' });
      return;
    }

    await prisma.medicationChangeProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.DECLINED, decidedAt: new Date() },
    });

    await createAuditEntry({
      profileId,
      actor: AuditActor.ELDER,
      action: 'MEDICATION_CHANGE_DECLINED',
      entityType: 'MedicationChangeProposal',
      entityId: proposalId,
      after: { reason: reason || 'Declined by elder' },
    });

    res.json({ message: 'Proposed changes declined.' });
    return;
  }

  // Declining a new pending medication
  const pendingMed = await prisma.medication.findFirst({
    where: { id, profileId, status: MedicationStatus.PENDING_APPROVAL },
  });

  if (!pendingMed) {
    res.status(404).json({ error: 'Pending medication not found.' });
    return;
  }

  await prisma.medication.update({
    where: { id },
    data: { status: MedicationStatus.ARCHIVED },
  });

  await createAuditEntry({
    profileId,
    actor: AuditActor.ELDER,
    action: 'MEDICATION_PROPOSAL_DECLINED',
    entityType: 'Medication',
    entityId: id,
    before: pendingMed,
    after: { reason: reason || 'Declined by elder' },
  });

  res.json({ message: 'Proposed medication declined.' });
});

export default router;
