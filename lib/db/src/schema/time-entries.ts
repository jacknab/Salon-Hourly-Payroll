import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const timeEntriesTable = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  workDate: date("work_date", { mode: "string" }).notNull(),
  hours: numeric("hours", { precision: 6, scale: 2, mode: "number" }).notNull(),
  note: text("note"),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntriesTable).omit({ id: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntriesTable.$inferSelect;