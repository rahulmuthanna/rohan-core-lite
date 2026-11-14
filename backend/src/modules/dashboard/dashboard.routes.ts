import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { loadDashboard } from './dashboard.repo.js';

export const dashboardRouter = Router();

// GET /api/dashboard : unit counts, booking value, collections and outstanding balance.
dashboardRouter.get('/', async (_req, res) => {
  res.json({ data: await loadDashboard(pool) });
});
