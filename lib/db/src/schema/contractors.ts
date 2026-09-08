import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const contractorsTable = pgTable("contractors", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  businessName: text("business_name"),
  email: text("email"),
  workState: text("work_state").notNull().default("CO"),
  status: text("status").notNull().default("active"),
  taxClassification: text("tax_classification").notNull().default("individual"),
  w9Status: text("w9_status").notNull().default("missing"),
  taxYear: integer("tax_year").notNull(),
  ytdReportableCompensation: numeric("ytd_reportable_compensation", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  stateTaxWithheld: numeric("state_tax_withheld", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  taxProfileReviewed: text("tax_profile_reviewed").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContractorSchema = createInsertSchema(contractorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type Contractor = typeof contractorsTable.$inferSelect;