# Rohan Core Lite

A small real estate sales application for selling flats. It covers the whole sales flow:

**Unit → Cost sheet → Quotation → Booking → Payments**

A sales executive picks an available flat, prices it for a customer with an optional discount, turns that into a quotation, books the flat once the quotation is accepted, and records payments against four construction milestones.

| Layer | Stack |
|---|---|
| Database | PostgreSQL 16, plain SQL migrations |
| Backend | Node.js 22+, TypeScript, Express 5, `pg`, Zod |
| Frontend | React 19, React Router, TypeScript, Vite, plain CSS |
| Tests | Vitest + Supertest (backend, real database), Vitest (frontend) |

---

## Quick start

### Prerequisites

- **Node.js 22 or newer**
- **PostgreSQL** — either Docker Desktop (recommended, uses `docker-compose.yml`) or any PostgreSQL 14+ server you can create databases on

### 1. Start the database

```bash
docker compose up -d db
```

This starts PostgreSQL 16 on **port 5433** with user `rohan`, password `rohan_dev_password` and database `rohan_core_lite` (local development values only).

> Using your own PostgreSQL instead? Skip this step and edit `DATABASE_URL` and `TEST_DATABASE_URL` in `backend/.env` (step 2) to point at your server. The test database name must end in `rohan_core_lite_test`; it is created automatically on the first test run, so the user needs permission to create databases.

### 2. Backend (API on port 4000)

```bash
cd backend
cp .env.example .env
npm install
npm run db:reset     # builds the schema and loads the 4 projects and 12 units
npm run dev          # Rohan Core Lite API listening on http://localhost:4000
```

### 3. Frontend (app on port 5173)

In a second terminal:

```bash
cd frontend
npm install
npm run dev          # Local: http://localhost:5173/
```

Open **http://localhost:5173**. The Vite dev server forwards every `/api` request to the backend, so there is no CORS setup and no backend address in the frontend code.

---

## Try the worked example

With both servers running:

1. **Inventory:** find **RN-101** (Rohan Nest, 2 BHK, ₹68,00,000) and choose **Create cost sheet**.
2. **Builder:** add a new customer and set the discount to **1%**. The preview shows Discount − ₹68,000 and Final offered price **₹67,32,000**. Save.
3. **Cost sheet:** choose **Create quotation**.
4. **Quotation:** **Mark as sent** → **Mark as accepted** → **Confirm booking**.
5. **Booking:** four milestones of ₹6,73,200 (10%), ₹13,46,400 (20%), ₹20,19,600 (30%) and ₹26,92,800 (40%).
6. **Record payment** of ₹5,00,000: outstanding becomes **₹62,32,000** and the Booking milestone balance **₹1,73,200**.
7. Try ₹2,00,000 next: it is rejected as an overpayment. Reuse the first payment reference: it is rejected as a duplicate.
8. On a cost sheet or quotation, **Print or save as PDF** prints only the document.

To start again from clean data at any time: `cd backend && npm run db:reset`.

---

## Commands

### Backend (`backend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with auto-reload on port 4000 |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| `npm run typecheck` | TypeScript check |
| `npm test` | 99 API tests against a separate test database |
| `npm run db:migrate` | Apply any pending migrations |
| `npm run db:seed` | Load the 4 projects and 12 units (safe to repeat) |
| `npm run db:reset` | Drop everything, migrate and seed (refuses when `NODE_ENV=production`) |
| `npm run db:verify` | 55 database self-checks in a rolled-back transaction (needs a freshly reset database) |

### Frontend (`frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on port 5173 |
| `npm run build` | Type check and build to `dist/` |
| `npm run preview` | Serve the production build on port 5173 |
| `npm run typecheck` | TypeScript check |
| `npm test` | 9 tests for parsing what users type (rupees, percent) and formatting money, discounts and dates |

---

## Project structure

```text
docker-compose.yml          Local PostgreSQL 16 (port 5433)
backend/
  db/
    migrations/             001–009: one numbered SQL file per change, applied in order
    seed/seed.sql           4 projects, 12 units
    verify/verify.sql       Database self-check (55 checks)
  src/
    app.ts                  Builds the Express app: routes, then the error handlers
    server.ts               Starts listening
    config/env.ts           Reads backend/.env
    db/                     Connection pool, transaction helper, migrate/seed/reset tooling
    shared/                 Business rules, money maths, dates, error codes, error handler, validation
    modules/<feature>/      One folder per feature (projects, units, customers, cost-sheets,
                            quotations, bookings, payments, dashboard), each with:
      *.routes.ts             HTTP only: validate the request, call the service, send the response
      *.schemas.ts            Request rules (Zod)
      *.service.ts            Business rules and transactions — no SQL, no HTTP
      *.repo.ts               SQL only; every function takes a Db so it works inside a transaction
    scripts/                Command-line wrappers for db:migrate / seed / reset / verify
  tests/                    API tests that send real HTTP requests and check real rows
frontend/
  src/
    api/                    types.ts (API shapes), client.ts (one fetch wrapper), endpoints.ts
    lib/                    Formatting/parsing helpers and the useLoad data-loading hook
    components/             Layout, dialogs, form fields, status tags, pagination, printable document
    pages/                  One file per screen
    styles/                 tokens.css (colours and sizes), base, layout, components, document, print
```

---

## Business rules

| Area | Rule |
|---|---|
| Discount | 0% to 2%, stored in basis points (100 = 1%). Discount amount is rounded to the nearest paisa, halves up. |
| Cost sheet | Freezes the price at the moment it is saved; later unit price changes do not affect it. Can only be deleted while no quotation uses it. |
| Quotation | Starts as **Draft**, then **Sent**, then **Accepted** (forward only). Valid for 7 days from the issue date. |
| Expiry | **Expired** is never stored. A quotation without a booking is shown as expired once today's date in India is after `valid_until`. |
| Booking | Only from an Accepted, unexpired quotation, and only while the unit is Available. One booking per unit and one per quotation. |
| Milestones | Created with the booking: Booking 10%, Foundation 20%, Structure 30%, Handover 40%. The last one absorbs rounding so the four always add up to the final price exactly. |
| Payments | Go to the earliest milestone with a balance. Cannot exceed that milestone's balance, cannot be dated in the future, and each payment reference is unique (case-insensitive). |
| Unit status | Available → Booked when a booking is confirmed. Price can only be changed while Available. |

---

## Design decisions

- **Money is whole paise in `bigint`.** ₹68,00,000 is stored as `680000000`. There are no floating-point or decimal money columns, so every calculation is exact.
- **Totals are never stored.** Collected and outstanding amounts are summed from `payments` whenever they are needed, so they can never drift out of step.
- **Frozen records.** Cost sheets, bookings, milestones and payments reject every `UPDATE` through a database trigger. History cannot be rewritten.
- **Defence in depth.** Booking and payment run in one transaction with row locks (`SELECT … FOR UPDATE`), so two simultaneous requests for the same flat are handled safely: the second waits, then sees the flat is booked. Unique and check constraints in the database act as a second safety net, and the error handler turns those constraint errors into the same friendly API errors.
- **Nothing cascades.** Every foreign key is `ON DELETE RESTRICT`.
- **No calculations in the browser.** Every money figure, including the live cost-sheet preview, comes from the API.
- **"Today" means today in India** (`Asia/Kolkata`) for validity and payment dates.
- **Readable document numbers** such as `CS-2026-0001`, `QT-2026-0001` and `BK-2026-0001` are generated by the database.

---

## API

Every path starts with `/api`. Successful responses are `{ "data": ... }`; lists add `"pagination": { "page", "page_size", "total" }` and accept `page` (default 1) and `page_size` (default 20, max 100). Errors are always:

```json
{ "error": { "code": "UNIT_NOT_AVAILABLE", "message": "…", "details": [{ "field": "…", "message": "…" }] } }
```

Status codes: `400` invalid request, `404` not found, `409` conflicts with current data, `500` server fault.

| Method and path | Purpose |
|---|---|
| `GET /health` | Server and database are reachable |
| `GET /projects` | All projects |
| `GET /units`, `GET /units/:id` | Inventory (filters `project_id`, `unit_type`, `status`) |
| `PATCH /units/:id/price` | Change the listed price of an Available unit |
| `GET /customers`, `GET /customers/:id` | Customers (filter `search`) |
| `POST /customers`, `PATCH /customers/:id` | Add or edit a customer (mobile must be unique) |
| `POST /cost-sheets/preview` | Calculate a cost sheet without saving |
| `GET /cost-sheets`, `GET /cost-sheets/:id` | Cost sheets (filters `customer_id`, `unit_id`) |
| `POST /cost-sheets`, `DELETE /cost-sheets/:id` | Save, or delete one with no quotation |
| `GET /quotations`, `GET /quotations/:id` | Quotations (filters `status` incl. `EXPIRED`, `customer_id`, `unit_id`, `cost_sheet_id`) |
| `POST /quotations` | Create a Draft from a cost sheet |
| `POST /quotations/:id/send`, `POST /quotations/:id/accept` | Draft → Sent → Accepted |
| `GET /bookings`, `GET /bookings/:id` | Bookings with totals; one booking with milestones and payments |
| `POST /bookings` | Book from an Accepted quotation |
| `POST /bookings/:id/payments` | Record a payment |
| `GET /dashboard` | Unit counts, booking value, collected and outstanding |

---

## Testing

```bash
cd backend && npm test      # 99 tests, 9 files
cd frontend && npm test     # 9 tests
cd backend && npm run db:reset && npm run db:verify   # 55 database checks
```

The backend tests use their own database (`TEST_DATABASE_URL`), created automatically and wiped before every test, so they never touch the application data. They cover the discount rules, quotation status and expiry, duplicate bookings (including simultaneous requests), overpayments and duplicate payment references, and the worked example above.
