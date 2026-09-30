import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const uploadClaimsTable = pgTable("farm_connect_upload_claims", {
  objectPath: text("object_path").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});