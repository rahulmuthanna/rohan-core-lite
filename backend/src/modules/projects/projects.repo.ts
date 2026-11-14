import type { Db } from '../../db/transaction.js';

export interface Project {
  id: number;
  name: string;
}

export async function listProjects(db: Db): Promise<Project[]> {
  const result = await db.query<Project>('SELECT id, name FROM projects ORDER BY name');
  return result.rows;
}
