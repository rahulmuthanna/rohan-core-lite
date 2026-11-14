import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { listProjects } from './projects.repo.js';

export const projectsRouter = Router();

// GET /api/projects : every project, for the inventory filter.
projectsRouter.get('/', async (_req, res) => {
  res.json({ data: await listProjects(pool) });
});
