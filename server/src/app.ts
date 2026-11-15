import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import medicationRoutes from './routes/medications.js';
import doseLogRoutes from './routes/doseLog.js';
import appointmentRoutes from './routes/appointments.js';
import auditLogRoutes from './routes/auditLog.js';
import demoClockRoutes from './routes/demoClock.js';
import emailLogRoutes from './routes/emailLog.js';
import insightsRoutes from './routes/insights.js';
import aiRoutes from './routes/ai.js';

export function createApp() {
  const app = express();

  // ── Security middleware ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL ?? 'http://localhost:5173'
        : 'http://localhost:5173',
      credentials: true,
    }),
  );

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '7mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'caresync-api' });
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/medications', medicationRoutes);
  app.use('/api/doses', doseLogRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/demo/clock', demoClockRoutes);
  app.use('/api/email-logs', emailLogRoutes);
  app.use('/api/insights', insightsRoutes);
  app.use('/api/ai', aiRoutes);

  // ── 404 handler ────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  // ── Global error handler ───────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

