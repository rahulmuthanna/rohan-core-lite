import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import type { UnitStatus } from '../../shared/business-rules.js';
import { conflict, ErrorCode, notFound } from '../../shared/errors.js';
import type { Pagination } from '../../shared/validation.js';
import * as unitsRepo from './units.repo.js';
import type { Unit } from './units.repo.js';
import type { ListUnitsQuery } from './units.schemas.js';

export function unitNotFound(): Error {
  return notFound(ErrorCode.UNIT_NOT_FOUND, 'Unit not found.');
}

/**
 * The one check used everywhere a unit must still be for sale:
 * re-pricing, cost sheets, quotations and bookings.
 */
export function ensureUnitIsAvailable(unit: { unit_code: string; status: UnitStatus }): void {
  if (unit.status !== 'AVAILABLE') {
    const reason = unit.status === 'BOOKED' ? 'already booked' : 'already sold';
    throw conflict(ErrorCode.UNIT_NOT_AVAILABLE, `Unit ${unit.unit_code} is ${reason}.`);
  }
}

export async function listUnits(query: ListUnitsQuery): Promise<{ data: Unit[]; pagination: Pagination }> {
  const { page, page_size, ...filters } = query;
  const { rows, total } = await unitsRepo.listUnits(pool, filters, page, page_size);
  return { data: rows, pagination: { page, page_size, total } };
}

export async function getUnit(id: number): Promise<Unit> {
  const unit = await unitsRepo.findUnitById(pool, id);
  if (!unit) {
    throw unitNotFound();
  }
  return unit;
}

/** Rule U3: only the price can change, and only while the unit is Available. */
export async function changeUnitPrice(id: number, listedPricePaise: number): Promise<Unit> {
  return withTransaction(async (tx) => {
    const unit = await unitsRepo.lockUnit(tx, id);
    if (!unit) {
      throw unitNotFound();
    }
    ensureUnitIsAvailable(unit);
    await unitsRepo.updateUnitPrice(tx, id, listedPricePaise);
    return (await unitsRepo.findUnitById(tx, id)) as Unit;
  });
}
