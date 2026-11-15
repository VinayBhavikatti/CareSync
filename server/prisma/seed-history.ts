import { PrismaClient, DoseStatus } from '@prisma/client';
import dotenv from 'dotenv';
import { decodeMedicationTimes } from '../src/utils/medicationTimes.js';
import { addLocalDays, localDateKey, localDateTimeToUtc, localDayOfWeek } from '../src/utils/timezone.js';
dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.careProfile.findFirst({ where: { name: 'Ramesh Kumar (Demo)' }, include: { medications: { where: { status: 'ACTIVE' } } } });
  if (!profile) throw new Error('Seed the demo profile first with npm run db:seed.');
  const todayKey = localDateKey(new Date(), profile.timezone);
  await prisma.doseLog.deleteMany({ where: { profileId: profile.id, note: 'DEMO_HISTORY_SEED' } });
  const data: Array<{ medicationId:string; profileId:string; scheduledAt:Date; status:DoseStatus; loggedAt:Date|null; loggedBy:'ELDER'|'CARETAKER'|null; note:string }> = [];
  for (let offset=30; offset>0; offset--) {
    const dateKey = addLocalDays(todayKey, -offset);
    const weekend = [0, 6].includes(localDayOfWeek(localDateTimeToUtc(dateKey, '12:00', profile.timezone), profile.timezone));
    for (const med of profile.medications) for (const time of decodeMedicationTimes(med.times)) {
      const [hour] = time.split(':').map(Number);
      const scheduledAt = localDateTimeToUtc(dateKey, time, profile.timezone);
      const evening = hour>=17;
      const seed = (offset*17 + hour*13 + med.id.charCodeAt(0)) % 100;
      const missChance = (weekend?30:8) + (evening?18:0);
      const skipChance = 5;
      const status = seed < missChance ? DoseStatus.MISSED : seed < missChance+skipChance ? DoseStatus.SKIPPED : DoseStatus.TAKEN;
      const loggedAt = status===DoseStatus.TAKEN ? new Date(scheduledAt.getTime()+((seed%5===0)?25:8)*60000) : null;
      data.push({ medicationId: med.id, profileId: profile.id, scheduledAt, status, loggedAt, loggedBy: status===DoseStatus.TAKEN?'ELDER':null, note:'DEMO_HISTORY_SEED' });
    }
  }
  if (data.length) await prisma.doseLog.createMany({ data });
  console.log(`Seeded ${data.length} historical doses for ${profile.name}.`);
}
main().catch(err=>{ console.error('History seed failed:',err); process.exitCode=1; }).finally(()=>prisma.$disconnect());
