import { createInsertSchema } from "drizzle-zod";
import { date, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const payPeriodsTable = pgTable("pay_periods", {
  id: serial("id").primaryKey(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  payDate: date("pay_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("open"),
});

export const insertPayPeriodSchema = createInsertSchema(payPeriodsTable).omit({ id: true });
export type InsertPayPeriod = z.infer<typeof insertPayPeriodSchema>;
export type PayPeriod = typeof payPeriodsTable.$inferSelect;