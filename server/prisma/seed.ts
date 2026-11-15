/**
 * Seed script — creates one demo care profile with 3 medications and 1 appointment.
 *
 * Run: npm run db:seed --workspace=server
 *
 * Demo passcodes (printed to console after seeding):
 *   Elder:     caresync-elder
 *   Caretaker: caresync-care
 *   Family:    caresync-fam
 */

import { PrismaClient, AuditActor } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { encodeMedicationTimes } from '../src/utils/medicationTimes.js';
import { addLocalDays, localDateKey, localDateTimeToUtc } from '../src/utils/timezone.js';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CareSync database...\n');

  // Clean up existing demo data
  await prisma.careProfile.deleteMany({ where: { name: 'Ramesh Kumar (Demo)' } });

  const SALT_ROUNDS = 12;
  const [elderHash, caretakerHash, familyHash] = await Promise.all([
    bcrypt.hash('caresync-elder', SALT_ROUNDS),
    bcrypt.hash('caresync-care', SALT_ROUNDS),
    bcrypt.hash('caresync-fam', SALT_ROUNDS),
  ]);

  // ── Care profile ───────────────────────────────────────────────────────────
  const profile = await prisma.careProfile.create({
    data: {
      name: 'Ramesh Kumar (Demo)',
      elderPasscodeHash: elderHash,
      caretakerPasscodeHash: caretakerHash,
      familyPasscodeHash: familyHash,
      elderEmail: 'elder@demo.caresync',
      caretakerEmail: 'caretaker@demo.caresync',
      familyEmail: 'family@demo.caresync',
      timezone: 'Asia/Kolkata',
    },
  });

  // ── Medications ────────────────────────────────────────────────────────────
  const med1 = await prisma.medication.create({
    data: {
      profileId: profile.id,
      name: 'Metformin',
      dosage: '500mg',
      instructions: 'Take with food. Do not crush or chew.',
      times: encodeMedicationTimes(['08:00', '20:00']),
      stockCount: 60,
      pillsPerDose: 1,
      status: 'ACTIVE',
      proposedBy: 'ELDER',
      approvedAt: new Date(),
    },
  });

  const med2 = await prisma.medication.create({
    data: {
      profileId: profile.id,
      name: 'Amlodipine',
      dosage: '5mg',
      instructions: 'Take at the same time each day. Ask your doctor about grapefruit.',
      times: encodeMedicationTimes(['09:00']),
      stockCount: 30,
      pillsPerDose: 1,
      status: 'ACTIVE',
      proposedBy: 'ELDER',
      approvedAt: new Date(),
    },
  });

  const med3 = await prisma.medication.create({
    data: {
      profileId: profile.id,
      name: 'Vitamin D3',
      dosage: '1000 IU',
      instructions: 'Take with a meal that contains fat for best absorption.',
      times: encodeMedicationTimes(['13:00']),
      stockCount: 90,
      pillsPerDose: 1,
      status: 'ACTIVE',
      proposedBy: 'ELDER',
      approvedAt: new Date(),
    },
  });

  // ── Appointment ────────────────────────────────────────────────────────────
  const appointmentDate = localDateTimeToUtc(addLocalDays(localDateKey(new Date(), profile.timezone), 3), '10:30', profile.timezone);

  await prisma.appointment.create({
    data: {
      profileId: profile.id,
      title: 'Cardiology Follow-up',
      doctorName: 'Dr. Priya Sharma',
      location: 'Apollo Hospital, Bangalore — Room 304',
      scheduledAt: appointmentDate,
      notes: 'Bring previous ECG reports and blood sugar log.',
      status: 'UPCOMING',
    },
  });

  // ── Audit log ──────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        profileId: profile.id,
        actor: AuditActor.SYSTEM,
        action: 'PROFILE_SEEDED',
        entityType: 'CareProfile',
        entityId: profile.id,
        after: { source: 'seed' },
      },
      {
        profileId: profile.id,
        actor: AuditActor.ELDER,
        action: 'MEDICATION_ADDED',
        entityType: 'Medication',
        entityId: med1.id,
        after: { name: med1.name, dosage: med1.dosage },
      },
      {
        profileId: profile.id,
        actor: AuditActor.ELDER,
        action: 'MEDICATION_ADDED',
        entityType: 'Medication',
        entityId: med2.id,
        after: { name: med2.name, dosage: med2.dosage },
      },
      {
        profileId: profile.id,
        actor: AuditActor.ELDER,
        action: 'MEDICATION_ADDED',
        entityType: 'Medication',
        entityId: med3.id,
        after: { name: med3.name, dosage: med3.dosage },
      },
    ],
  });

  // ── Print results ─────────────────────────────────────────────────────────
  console.log('✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DEMO LOGIN CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Profile ID : ${profile.id}`);
  console.log('  Elder      : caresync-elder');
  console.log('  Caretaker  : caresync-care');
  console.log('  Family     : caresync-fam');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

