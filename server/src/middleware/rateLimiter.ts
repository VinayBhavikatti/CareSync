import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

/**
 * Check if a given (profileId, role, ip) combination is currently rate-limited.
 * Returns { blocked: true, retryAfterMinutes } if blocked, otherwise { blocked: false }.
 */
export async function checkRateLimit(
  profileId: string,
  role: Role,
  ipAddress: string,
): Promise<{ blocked: boolean; retryAfterMinutes?: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const recentAttempts = await prisma.rateLimitAttempt.findMany({
    where: {
      profileId,
      role,
      ipAddress,
      attemptedAt: { gte: windowStart },
    },
    orderBy: { attemptedAt: 'asc' },
  });

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const oldestAttempt = recentAttempts[0].attemptedAt;
    const unlocksAt = new Date(oldestAttempt.getTime() + WINDOW_MINUTES * 60 * 1000);
    const retryAfterMinutes = Math.ceil((unlocksAt.getTime() - Date.now()) / 60000);
    return { blocked: true, retryAfterMinutes: Math.max(1, retryAfterMinutes) };
  }

  return { blocked: false };
}

/**
 * Record a failed passcode attempt for rate-limiting purposes.
 */
export async function recordFailedAttempt(
  profileId: string,
  role: Role,
  ipAddress: string,
): Promise<void> {
  await prisma.rateLimitAttempt.create({
    data: { profileId, role, ipAddress },
  });
}

/**
 * Clean up attempts older than the window (call periodically to prevent table bloat).
 */
export async function pruneOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  await prisma.rateLimitAttempt.deleteMany({
    where: { attemptedAt: { lt: cutoff } },
  });
}

