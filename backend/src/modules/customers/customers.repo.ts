import { limitAndOffset, type Db } from '../../db/transaction.js';

export interface Customer {
  id: number;
  full_name: string;
  mobile: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

const CUSTOMER_COLUMNS = 'id, full_name, mobile, email, created_at, updated_at';

/** Escapes the characters that have a special meaning inside a LIKE pattern. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}

export async function listCustomers(
  db: Db,
  search: string | undefined,
  page: number,
  pageSize: number,
): Promise<{ rows: Customer[]; total: number }> {
  const values: unknown[] = [];
  let where = '';
  if (search !== undefined && search !== '') {
    values.push(likePattern(search));
    where = 'WHERE full_name ILIKE $1 OR mobile ILIKE $1 OR email ILIKE $1';
  }
  const count = await db.query<{ total: number }>(`SELECT count(*) AS total FROM customers ${where}`, values);
  const { limit, offset } = limitAndOffset(page, pageSize);
  const rows = await db.query<Customer>(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers ${where}
     ORDER BY full_name, id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export async function findCustomerById(db: Db, id: number): Promise<Customer | undefined> {
  const result = await db.query<Customer>(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function findCustomerByMobile(db: Db, mobile: string): Promise<Customer | undefined> {
  const result = await db.query<Customer>(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE mobile = $1`, [mobile]);
  return result.rows[0];
}

export async function insertCustomer(
  db: Db,
  input: { full_name: string; mobile: string; email: string },
): Promise<Customer> {
  const result = await db.query<Customer>(
    `INSERT INTO customers (full_name, mobile, email) VALUES ($1, $2, $3) RETURNING ${CUSTOMER_COLUMNS}`,
    [input.full_name, input.mobile, input.email],
  );
  return result.rows[0] as Customer;
}

/** Changes only the fields that were provided; the others keep their current value. */
export async function updateCustomer(
  db: Db,
  id: number,
  input: { full_name?: string | undefined; mobile?: string | undefined; email?: string | undefined },
): Promise<Customer | undefined> {
  const result = await db.query<Customer>(
    `UPDATE customers
     SET full_name = COALESCE($2, full_name),
         mobile    = COALESCE($3, mobile),
         email     = COALESCE($4, email)
     WHERE id = $1
     RETURNING ${CUSTOMER_COLUMNS}`,
    [id, input.full_name ?? null, input.mobile ?? null, input.email ?? null],
  );
  return result.rows[0];
}
