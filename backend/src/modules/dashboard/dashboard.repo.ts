import type { Db } from '../../db/transaction.js';

export interface UnitCounts {
  total: number;
  available: number;
  booked: number;
  sold: number;
}

export interface ProjectUnitCounts extends UnitCounts {
  project_id: number;
  project_name: string;
}

export interface Dashboard {
  units: UnitCounts;
  bookings_count: number;
  /** D2: the sum of the final price of every booking. */
  booking_value_paise: number;
  /** D3: the sum of every payment. */
  collected_paise: number;
  /** D4: booking value minus collections. */
  outstanding_paise: number;
  by_project: ProjectUnitCounts[];
}

const UNIT_COUNT_COLUMNS = `
  count(u.id) AS total,
  count(u.id) FILTER (WHERE u.status = 'AVAILABLE') AS available,
  count(u.id) FILTER (WHERE u.status = 'BOOKED') AS booked,
  count(u.id) FILTER (WHERE u.status = 'SOLD') AS sold`;

/** Every figure is read live from the database; nothing on the dashboard is stored. */
export async function loadDashboard(db: Db): Promise<Dashboard> {
  const units = await db.query<UnitCounts>(`SELECT ${UNIT_COUNT_COLUMNS} FROM units u`);

  const byProject = await db.query<ProjectUnitCounts>(
    `SELECT p.id AS project_id, p.name AS project_name, ${UNIT_COUNT_COLUMNS}
     FROM projects p
     LEFT JOIN units u ON u.project_id = p.id
     GROUP BY p.id
     ORDER BY p.name`,
  );

  const bookings = await db.query<{ bookings_count: number; booking_value_paise: number }>(
    `SELECT count(*) AS bookings_count,
            COALESCE(SUM(cs.final_price_paise), 0)::bigint AS booking_value_paise
     FROM bookings b
     JOIN quotations q ON q.id = b.quotation_id
     JOIN cost_sheets cs ON cs.id = q.cost_sheet_id`,
  );

  const payments = await db.query<{ collected_paise: number }>(
    'SELECT COALESCE(SUM(amount_paise), 0)::bigint AS collected_paise FROM payments',
  );

  const bookingValuePaise = bookings.rows[0]?.booking_value_paise ?? 0;
  const collectedPaise = payments.rows[0]?.collected_paise ?? 0;
  return {
    units: units.rows[0] ?? { total: 0, available: 0, booked: 0, sold: 0 },
    bookings_count: bookings.rows[0]?.bookings_count ?? 0,
    booking_value_paise: bookingValuePaise,
    collected_paise: collectedPaise,
    outstanding_paise: bookingValuePaise - collectedPaise,
    by_project: byProject.rows,
  };
}
