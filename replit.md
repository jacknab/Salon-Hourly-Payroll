# Salon Payroll

An hourly payroll workspace for salon owners to manage staff, review hours, and prepare gross-pay runs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the payroll API contract
- `lib/db/src/schema/` — Drizzle schema for staff, time entries, pay periods, pay runs, and payroll lines
- `artifacts/api-server/src/routes/payroll.ts` — payroll API handlers and gross-pay calculation
- `artifacts/salon-payroll/src/` — React dashboard, staff, time entry, and payroll review screens
- `artifacts/salon-payroll/src/index.css` — shared visual theme and design tokens

## Architecture decisions

- v1 calculates gross hourly wages only; taxes, benefits, PTO, vacation, deductions, and direct money movement are intentionally out of scope.
- Time entries are calendar dates and payroll periods calculate totals from entries whose work date falls within the period.
- Removing staff marks them inactive instead of deleting historical identity needed for payroll records.
- Payroll calculation creates or refreshes a reviewable pay run and stores line-level snapshots of rate, hours, and gross pay.

## Product

- Dashboard with active staff, hours to review, current gross pay, next pay date, current period, and recent entries
- Staff management with hourly rate and active/inactive status
- Time-entry management with staff, date, hours, notes, search, and deletion
- Pay-period creation, calculation, pay-run review, and print/export-ready payroll detail

## User preferences

No additional preferences recorded.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm --filter @workspace/db run push` after changing the Drizzle schema.
- API date inputs are coerced by generated Zod schemas and converted back to `YYYY-MM-DD` strings before database writes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
