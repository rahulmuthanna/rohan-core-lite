import express, { type Express } from 'express';
import { pool } from './db/pool.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { costSheetsRouter } from './modules/cost-sheets/cost-sheets.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { quotationsRouter } from './modules/quotations/quotations.routes.js';
import { unitsRouter } from './modules/units/units.routes.js';
import { errorHandler, notFoundHandler } from './shared/error-handler.js';

/**
 * Builds the Express application: every route, then the two error handlers.
 * It does not start listening; server.ts does that. Tests use this function directly.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // GET /api/health : confirms the server and the database are reachable.
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ data: { status: 'ok' } });
  });

  app.use('/api/projects', projectsRouter);
  app.use('/api/units', unitsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/cost-sheets', costSheetsRouter);
  app.use('/api/quotations', quotationsRouter);
  app.use('/api/bookings/:id/payments', paymentsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/dashboard', dashboardRouter);

  // These two must stay last: unknown routes, then every thrown error.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
