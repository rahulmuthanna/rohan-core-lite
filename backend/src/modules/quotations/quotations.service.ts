import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import type { StoredQuotationStatus } from '../../shared/business-rules.js';
import { conflict, ErrorCode, notFound } from '../../shared/errors.js';
import type { Pagination } from '../../shared/validation.js';
import { findCostSheetById } from '../cost-sheets/cost-sheets.repo.js';
import { costSheetNotFound } from '../cost-sheets/cost-sheets.service.js';
import { lockUnit } from '../units/units.repo.js';
import { ensureUnitIsAvailable, unitNotFound } from '../units/units.service.js';
import * as quotationsRepo from './quotations.repo.js';
import type { Quotation } from './quotations.repo.js';
import type { CreateQuotationInput, ListQuotationsQuery } from './quotations.schemas.js';

export function quotationNotFound(): Error {
  return notFound(ErrorCode.QUOTATION_NOT_FOUND, 'Quotation not found.');
}

export function quotationExpired(quotation: { quotation_number: string; valid_until: string }): Error {
  return conflict(
    ErrorCode.QUOTATION_EXPIRED,
    `Quotation ${quotation.quotation_number} expired after ${quotation.valid_until}. Create a new quotation from the same cost sheet.`,
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
};

export async function listQuotations(
  query: ListQuotationsQuery,
): Promise<{ data: Quotation[]; pagination: Pagination }> {
  const { page, page_size, ...filters } = query;
  const { rows, total } = await quotationsRepo.listQuotations(pool, filters, page, page_size);
  return { data: rows, pagination: { page, page_size, total } };
}

export async function getQuotation(id: number): Promise<Quotation> {
  const quotation = await quotationsRepo.findQuotationById(pool, id);
  if (!quotation) {
    throw quotationNotFound();
  }
  return quotation;
}

/** Rule Q1: a quotation is created from a saved cost sheet, only while the unit is Available. */
export async function createQuotation(input: CreateQuotationInput): Promise<Quotation> {
  return withTransaction(async (tx) => {
    const costSheet = await findCostSheetById(tx, input.cost_sheet_id);
    if (!costSheet) {
      throw costSheetNotFound();
    }
    const unit = await lockUnit(tx, costSheet.unit_id);
    if (!unit) {
      throw unitNotFound();
    }
    ensureUnitIsAvailable(unit);

    const id = await quotationsRepo.insertQuotation(tx, costSheet.id);
    return (await quotationsRepo.findQuotationById(tx, id)) as Quotation;
  });
}

/**
 * Rules Q3, Q5 and Q6: status moves one step at a time and only forward.
 * `from` is the status the quotation must have now; `to` is the status it gets.
 */
async function moveForward(id: number, from: StoredQuotationStatus, to: StoredQuotationStatus): Promise<Quotation> {
  return withTransaction(async (tx) => {
    if (!(await quotationsRepo.lockQuotation(tx, id))) {
      throw quotationNotFound();
    }
    const quotation = (await quotationsRepo.findQuotationById(tx, id)) as Quotation;

    if (quotation.status === 'EXPIRED') {
      throw quotationExpired(quotation);
    }
    if (quotation.status !== from) {
      throw conflict(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Only a ${STATUS_LABEL[from]} quotation can be marked as ${STATUS_LABEL[to]}. This quotation is ${STATUS_LABEL[quotation.status]}.`,
      );
    }
    ensureUnitIsAvailable({ unit_code: quotation.unit_code, status: quotation.unit_status });

    await quotationsRepo.updateQuotationStatus(tx, id, to);
    return (await quotationsRepo.findQuotationById(tx, id)) as Quotation;
  });
}

export function sendQuotation(id: number): Promise<Quotation> {
  return moveForward(id, 'DRAFT', 'SENT');
}

export function acceptQuotation(id: number): Promise<Quotation> {
  return moveForward(id, 'SENT', 'ACCEPTED');
}
