import { Router } from 'express';
import { idParamSchema, validate } from '../../shared/validation.js';
import { createCustomerSchema, listCustomersQuerySchema, updateCustomerSchema } from './customers.schemas.js';
import * as customersService from './customers.service.js';

export const customersRouter = Router();

// GET /api/customers : list, with optional search across name, mobile and email.
customersRouter.get('/', async (req, res) => {
  const query = validate(listCustomersQuerySchema, req.query);
  res.json(await customersService.listCustomers(query));
});

// GET /api/customers/:id : one customer.
customersRouter.get('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  res.json({ data: await customersService.getCustomer(id) });
});

// POST /api/customers : add a customer.
customersRouter.post('/', async (req, res) => {
  const input = validate(createCustomerSchema, req.body);
  res.status(201).json({ data: await customersService.createCustomer(input) });
});

// PATCH /api/customers/:id : change one or more fields of a customer.
customersRouter.patch('/:id', async (req, res) => {
  const { id } = validate(idParamSchema, req.params);
  const input = validate(updateCustomerSchema, req.body);
  res.json({ data: await customersService.updateCustomer(id, input) });
});
