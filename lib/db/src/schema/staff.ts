import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, numeric } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2, mode: "number" }).notNull(),
  status: text("status").notNull().default("active"),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;