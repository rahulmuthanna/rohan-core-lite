import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { conflict, ErrorCode, notFound } from '../../shared/errors.js';
import { calculateDiscount } from '../../shared/money.js';
import type { Pagination } from '../../shared/validation.js';
import { findCustomerById } from '../customers/customers.repo.js';
import { customerNotFound } from '../customers/customers.service.js';
import { findUnitById, lockUnit } from '../units/units.repo.js';
import { ensureUnitIsAvailable, unitNotFound } from '../units/units.service.js';
import * as costSheetsRepo from './cost-sheets.repo.js';
import type { CostSheet } from './cost-sheets.repo.js';
import type { CreateCostSheetInput, ListCostSheetsQuery, PreviewCostSheetInput } from './cost-sheets.schemas.js';

export function costSheetNotFound(): Error {
  return notFound(ErrorCode.COST_SHEET_NOT_FOUND, 'Cost sheet not found.');
}

export interface CostSheetPreview {
  unit_id: number;
  unit_code: string;
  listed_price_paise: number;
  discount_bps: number;
  discount_amount_paise: number;
  final_price_paise: number;
}

/**
 * Works out the figures for a cost sheet without saving anything.
 * The screen calls this as the user adjusts the discount, so the numbers shown
 * always come from the same server-side formula that is used when saving.
 */
export async function previewCostSheet(input: PreviewCostSheetInput): Promise<CostSheetPreview> {
  const unit = await findUnitById(pool, input.unit_id);
  if (!unit) {
    throw unitNotFound();
  }
  ensureUnitIsAvailable(unit);
  return {
    unit_id: unit.id,
    unit_code: unit.unit_code,
    listed_price_paise: unit.listed_price_paise,
    discount_bps: input.discount_bps,
    ...calculateDiscount(unit.listed_price_paise, input.discount_bps),
  };
}

/**
 * Rules CS1 to CS4. The price is read from the unit here, on the server,
 * and never accepted from the request. Once saved, the row is frozen.
 */
export async function createCostSheet(input: CreateCostSheetInput): Promise<CostSheet> {
  return withTransaction(async (tx) => {
    const unit = await lockUnit(tx, input.unit_id);
    if (!unit) {
      throw unitNotFound();
    }
    ensureUnitIsAvailable(unit);

    const customer = await findCustomerById(tx, input.customer_id);
    if (!customer) {
      throw customerNotFound();
    }

    const money = calculateDiscount(unit.listed_price_paise, input.discount_bps);
    const id = await costSheetsRepo.insertCostSheet(tx, {
      unit_id: unit.id,
      customer_id: customer.id,
      listed_price_paise: unit.listed_price_paise,
      discount_bps: input.discount_bps,
      ...money,
    });
    return (await costSheetsRepo.findCostSheetById(tx, id)) as CostSheet;
  });
}

export async function listCostSheets(
  query: ListCostSheetsQuery,
): Promise<{ data: CostSheet[]; pagination: Pagination }> {
  const { page, page_size, ...filters } = query;
  const { rows, total } = await costSheetsRepo.listCostSheets(pool, filters, page, page_size);
  return { data: rows, pagination: { page, page_size, total } };
}

export async function getCostSheet(id: number): Promise<CostSheet> {
  const costSheet = await costSheetsRepo.findCostSheetById(pool, id);
  if (!costSheet) {
    throw costSheetNotFound();
  }
  return costSheet;
}

/** Rule CS6: a cost sheet can be deleted only while no quotation has been created from it. */
export async function deleteCostSheet(id: number): Promise<void> {
  await withTransaction(async (tx) => {
    const costSheet = await costSheetsRepo.findCostSheetById(tx, id);
    if (!costSheet) {
      throw costSheetNotFound();
    }
    if (costSheet.quotation_count > 0) {
      throw conflict(
        ErrorCode.COST_SHEET_HAS_QUOTATIONS,
        'This cost sheet cannot be deleted because a quotation has been created from it.',
      );
    }
    await costSheetsRepo.deleteCostSheet(tx, id);
  });
}
