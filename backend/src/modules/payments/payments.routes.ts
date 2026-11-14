import { Router } from 'express';
import { idParamSchema, validate } from '../../shared/validation.js';
import { recordPaymentSchema } from './payments.schemas.js';
import * as paymentsService from './payments.service.js';

// Mounted at /api/bookings/:id/payments, so this router needs the :id from the parent path.
export const paymentsRouter = Router({ mergeParams: true });

// POST /api/bookings/:id/payments : record a payment against the booking's current milestone.
paymentsRouter.post('/', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  const input = validate(recordPaymentSchema, req.body);
  res.status(201).json({ data: await paymentsService.recordPayment(id, input) });
});
