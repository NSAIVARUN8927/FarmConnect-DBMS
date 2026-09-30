import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { usersTable } from "./users";

export const productsTable = pgTable(
  "farm_connect_products",
  {
    id: serial("id").primaryKey(),
    farmId: integer("farm_id").references(() => farmsTable.id, { onDelete: "set null" }),
    farmerId: integer("farmer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull().default("kg"),
    quantity: doublePrecision("quantity").notNull(),
    pricePerUnit: doublePrecision("price_per_unit").notNull(),
    location: text("location").notNull(),
    organic: boolean("organic").notNull().default(false),
    quality: text("quality"),
    harvestDate: date("harvest_date", { mode: "string" }),
    imageUrl: text("image_url"),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("farm_connect_products_farmer_idx").on(table.farmerId),
    index("farm_connect_products_category_idx").on(table.category),
    index("farm_connect_products_location_idx").on(table.location),
    index("farm_connect_products_available_idx").on(table.available),
    check("farm_connect_products_quantity_nonnegative", sql`${table.quantity} >= 0`),
    check("farm_connect_products_price_positive", sql`${table.pricePerUnit} > 0`),
  ],
);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;