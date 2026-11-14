import { Router } from 'express';
import { idParamSchema, validate } from '../../shared/validation.js';
import { createBookingSchema, listBookingsQuerySchema } from './bookings.schemas.js';
import * as bookingsService from './bookings.service.js';

export const bookingsRouter = Router();

// GET /api/bookings : list with collected and outstanding totals.
bookingsRouter.get('/', async (req, res) => {
  const query = validate(listBookingsQuerySchema, req.query);
  res.json(await bookingsService.listBookings(query));
});

// GET /api/bookings/:id : one booking with its milestones and payment history.
bookingsRouter.get('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await bookingsService.getBooking(id) });
});

// POST /api/bookings : confirm a booking from an Accepted, unexpired quotation.
bookingsRouter.post('/', async (req, res) => {
  const input = validate(createBookingSchema, req.body);
  res.status(201).json({ data: await bookingsService.createBooking(input) });
});
