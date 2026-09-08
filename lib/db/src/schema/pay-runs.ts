import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const payRunsTable = pgTable("pay_runs", {
  id: serial("id").primaryKey(),
  payPeriodId: integer("pay_period_id").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  totalHours: numeric("total_hours", { precision: 10, scale: 2, mode: "number" }).notNull(),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2, mode: "number" }).notNull(),
});

export const payrollLinesTable = pgTable("payroll_lines", {
  id: serial("id").primaryKey(),
  payRunId: integer("pay_run_id").notNull(),
  staffId: integer("staff_id").notNull(),
  staffName: text("staff_name").notNull(),
  role: text("role").notNull(),
  hours: numeric("hours", { precision: 10, scale: 2, mode: "number" }).notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2, mode: "number" }).notNull(),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2, mode: "number" }).notNull(),
});

export const insertPayRunSchema = createInsertSchema(payRunsTable).omit({ id: true, createdAt: true });
export const insertPayrollLineSchema = createInsertSchema(payrollLinesTable).omit({ id: true });
export type InsertPayRun = z.infer<typeof insertPayRunSchema>;
export type InsertPayrollLine = z.infer<typeof insertPayrollLineSchema>;
export type PayRun = typeof payRunsTable.$inferSelect;
export type PayrollLine = typeof payrollLinesTable.$inferSelect;