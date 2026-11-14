import { Router } from 'express';
import { idParamSchema, validate } from '../../shared/validation.js';
import { createQuotationSchema, listQuotationsQuerySchema } from './quotations.schemas.js';
import * as quotationsService from './quotations.service.js';

export const quotationsRouter = Router();

// GET /api/quotations : list, filtered by status (including EXPIRED), customer, unit or cost sheet.
quotationsRouter.get('/', async (req, res) => {
  const query = validate(listQuotationsQuerySchema, req.query);
  res.json(await quotationsService.listQuotations(query));
});

// GET /api/quotations/:id : one quotation.
quotationsRouter.get('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await quotationsService.getQuotation(id) });
});

// POST /api/quotations : create a Draft quotation from a saved cost sheet.
quotationsRouter.post('/', async (req, res) => {
  const input = validate(createQuotationSchema, req.body);
  res.status(201).json({ data: await quotationsService.createQuotation(input) });
});

// POST /api/quotations/:id/send : Draft -> Sent.
quotationsRouter.post('/:id/send', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await quotationsService.sendQuotation(id) });
});

// POST /api/quotations/:id/accept : Sent -> Accepted.
quotationsRouter.post('/:id/accept', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await quotationsService.acceptQuotation(id) });
});
