# Morrow Payroll

An hourly payroll workspace for salon owners to manage staff, review hours, calculate employee deductions, estimate net pay, and review employer liabilities before payday. It is not a filing, remittance, or money-movement service.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
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

- The MVP calculates gross hourly wages, configurable employee tax deductions, FICA, FUTA, estimated net pay, and employer liabilities. It does not file returns, remit taxes, move money, or replace payroll/tax advice.
- Federal withholding uses an annualized 2026 baseline and employee-entered filing profile. Initial state withholding support covers Colorado, Arizona, and California through a small transparent rule table; other states produce a compliance warning instead of a false answer.
- Time entries are calendar dates and payroll periods calculate totals from entries whose work date falls within the period.
- Removing staff marks them inactive instead of deleting historical identity needed for payroll records.
- Payroll calculation creates or refreshes a reviewable pay run and stores line-level snapshots of rate, hours, gross-to-net deductions, and employer costs.

## Product

- Dashboard with active staff, hours to review, current gross pay, next pay date, current period, and recent entries
- Staff management with hourly rate, active/inactive status, and employee tax profile
- Time-entry management with staff, date, hours, notes, search, and deletion
- Pay-period creation, calculation, pay-run review, pay-stub calculations, employer liability summary, and print/export-ready detail
- Compliance workspace with free-first deadline tracking, EFTPS/SSA BSO/IRS IRIS links, local activity records, and W-2/1099/state report prep CSV exports. It intentionally does not file returns, remit taxes, or store SSNs/EINs.

## User preferences

No additional preferences recorded.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm --filter @workspace/db run push` after changing the Drizzle schema.
- API date inputs are coerced by generated Zod schemas and converted back to `YYYY-MM-DD` strings before database writes.
- Tax rules are intentionally centralized in `artifacts/api-server/src/lib/payroll-tax.ts`; update the rule set and its compliance copy together when tax-year guidance changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
