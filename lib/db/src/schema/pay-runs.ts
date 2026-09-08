import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const payRunsTable = pgTable("pay_runs", {
  id: serial("id").primaryKey(),
  payPeriodId: integer("pay_period_id").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  complianceWarnings: jsonb("compliance_warnings").$type<string[]>().notNull().default([]),
  totalHours: numeric("total_hours", { precision: 10, scale: 2, mode: "number" }).notNull(),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2, mode: "number" }).notNull(),
  federalWithholding: numeric("federal_withholding", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  stateWithholding: numeric("state_withholding", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  socialSecurity: numeric("social_security", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  medicare: numeric("medicare", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employeeTaxes: numeric("employee_taxes", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  netPay: numeric("net_pay", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employerSocialSecurity: numeric("employer_social_security", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employerMedicare: numeric("employer_medicare", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  futa: numeric("futa", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employerTaxes: numeric("employer_taxes", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  totalCost: numeric("total_cost", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
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
  federalWithholding: numeric("federal_withholding", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  stateWithholding: numeric("state_withholding", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  socialSecurity: numeric("social_security", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  medicare: numeric("medicare", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employeeTaxes: numeric("employee_taxes", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  netPay: numeric("net_pay", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employerSocialSecurity: numeric("employer_social_security", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employerMedicare: numeric("employer_medicare", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  futa: numeric("futa", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  employerTaxes: numeric("employer_taxes", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  totalCost: numeric("total_cost", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
});

export const insertPayRunSchema = createInsertSchema(payRunsTable).omit({ id: true, createdAt: true });
export const insertPayrollLineSchema = createInsertSchema(payrollLinesTable).omit({ id: true });
export type InsertPayRun = z.infer<typeof insertPayRunSchema>;
export type InsertPayrollLine = z.infer<typeof insertPayrollLineSchema>;
export type PayRun = typeof payRunsTable.$inferSelect;
export type PayrollLine = typeof payrollLinesTable.$inferSelect;