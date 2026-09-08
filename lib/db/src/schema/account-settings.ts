import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const accountSettingsTable = pgTable("account_settings", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull().default("Morrow Studio"),
  legalName: text("legal_name"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state").notNull().default("CO"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  payrollFrequency: text("payroll_frequency").notNull().default("biweekly"),
  defaultWorkState: text("default_work_state").notNull().default("CO"),
  federalDepositSchedule: text("federal_deposit_schedule").notNull().default("monthly"),
  stateWithholdingFrequency: text("state_withholding_frequency").notNull().default("quarterly"),
  einOnFile: text("ein_on_file").notNull().default("false"),
  stateAccountOnFile: text("state_account_on_file").notNull().default("false"),
  eftpsEnrolled: text("eftps_enrolled").notNull().default("false"),
  ssaBsoEnrolled: text("ssa_bso_enrolled").notNull().default("false"),
  irsIrisEnrolled: text("irs_iris_enrolled").notNull().default("false"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountSettingsSchema = createInsertSchema(accountSettingsTable).omit({ id: true, updatedAt: true });
export type InsertAccountSettings = z.infer<typeof insertAccountSettingsSchema>;
export type AccountSettings = typeof accountSettingsTable.$inferSelect;