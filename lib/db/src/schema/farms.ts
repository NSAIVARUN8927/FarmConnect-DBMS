import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const farmsTable = pgTable(
  "farm_connect_farms",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location").notNull(),
    acres: doublePrecision("acres").notNull(),
    soilType: text("soil_type"),
    irrigation: text("irrigation"),
    crops: text("crops").array().notNull().default(sql`ARRAY[]::text[]`),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("farm_connect_farms_owner_idx").on(table.ownerId)],
);

export const insertFarmSchema = createInsertSchema(farmsTable).omit({ id: true, createdAt: true });
export type InsertFarm = z.infer<typeof insertFarmSchema>;
export type Farm = typeof farmsTable.$inferSelect;