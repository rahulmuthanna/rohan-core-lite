import { Router } from 'express';
import { idParamSchema, validate } from '../../shared/validation.js';
import { changeUnitPriceSchema, listUnitsQuerySchema } from './units.schemas.js';
import * as unitsService from './units.service.js';

export const unitsRouter = Router();

// GET /api/units : inventory list, filtered by project, unit type and status.
unitsRouter.get('/', async (req, res) => {
  const query = validate(listUnitsQuerySchema, req.query);
  res.json(await unitsService.listUnits(query));
});

// GET /api/units/:id : one unit.
unitsRouter.get('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await unitsService.getUnit(id) });
});

// PATCH /api/units/:id/price : change the listed price of an Available unit.
unitsRouter.patch('/:id/price', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  const input = validate(changeUnitPriceSchema, req.body);
  res.json({ data: await unitsService.changeUnitPrice(id, input.listed_price_paise) });
});
