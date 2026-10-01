import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const billingFarmerDetailsTable = pgTable(
  "farm_connect_billing_farmer_details",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    farmerName: text("farmer_name").notNull(),
    farmName: text("farm_name"),
    gstin: text("gstin"),
    billingAddress: text("billing_address").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("farm_connect_billing_details_business_idx").on(table.businessId)],
);

export const insertBillingFarmerDetailsSchema = createInsertSchema(billingFarmerDetailsTable).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBillingFarmerDetails = z.infer<typeof insertBillingFarmerDetailsSchema>;
export type BillingFarmerDetails = typeof billingFarmerDetailsTable.$inferSelect;