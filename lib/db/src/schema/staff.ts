import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2, mode: "number" }).notNull(),
  status: text("status").notNull().default("active"),
  federalFilingStatus: text("federal_filing_status").notNull().default("single"),
  federalAllowances: integer("federal_allowances").notNull().default(0),
  extraFederalWithholding: numeric("extra_federal_withholding", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  workState: text("work_state").notNull().default("CO"),
  stateAllowances: integer("state_allowances").notNull().default(0),
  extraStateWithholding: numeric("extra_state_withholding", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  ytdWages: numeric("ytd_wages", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  ytdFutaWages: numeric("ytd_futa_wages", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  taxProfileReviewed: text("tax_profile_reviewed").notNull().default("false"),
  taxProfileUpdatedAt: timestamp("tax_profile_updated_at", { withTimezone: true }),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;