import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "farm_connect_users",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    displayName: text("display_name").notNull().default("New member"),
    role: text("role"),
    location: text("location"),
    businessName: text("business_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("farm_connect_users_clerk_id_uq").on(table.clerkId),
    index("farm_connect_users_role_idx").on(table.role),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;