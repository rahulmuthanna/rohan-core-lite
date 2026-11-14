import { Router } from 'express';
import { idParamSchema, validate } from '../../shared/validation.js';
import {
  createCostSheetSchema,
  listCostSheetsQuerySchema,
  previewCostSheetSchema,
} from './cost-sheets.schemas.js';
import * as costSheetsService from './cost-sheets.service.js';

export const costSheetsRouter = Router();

// POST /api/cost-sheets/preview : work out the figures without saving.
costSheetsRouter.post('/preview', async (req, res) => {
  const input = validate(previewCostSheetSchema, req.body);
  res.json({ data: await costSheetsService.previewCostSheet(input) });
});

// GET /api/cost-sheets : list, optionally for one customer or one unit.
costSheetsRouter.get('/', async (req, res) => {
  const query = validate(listCostSheetsQuerySchema, req.query);
  res.json(await costSheetsService.listCostSheets(query));
});

// GET /api/cost-sheets/:id : one cost sheet.
costSheetsRouter.get('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await costSheetsService.getCostSheet(id) });
});

// POST /api/cost-sheets : save a cost sheet for a unit and a customer.
costSheetsRouter.post('/', async (req, res) => {
  const input = validate(createCostSheetSchema, req.body);
  res.status(201).json({ data: await costSheetsService.createCostSheet(input) });
});

// DELETE /api/cost-sheets/:id : delete a cost sheet that has no quotation.
costSheetsRouter.delete('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  await costSheetsService.deleteCostSheet(id);
  res.status(204).end();
});
