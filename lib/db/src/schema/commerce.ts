import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const ordersTable = pgTable(
  "farm_connect_orders",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
    buyerId: integer("buyer_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    farmerId: integer("farmer_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    quantity: doublePrecision("quantity").notNull(),
    unit: text("unit").notNull(),
    pricePerUnit: doublePrecision("price_per_unit").notNull(),
    totalAmount: doublePrecision("total_amount").notNull(),
    status: text("status").notNull().default("payment_pending"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    paymentReference: text("payment_reference"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("farm_connect_orders_buyer_idx").on(table.buyerId),
    index("farm_connect_orders_farmer_idx").on(table.farmerId),
    index("farm_connect_orders_status_idx").on(table.status),
    check("farm_connect_orders_quantity_positive", sql`${table.quantity} > 0`),
    check("farm_connect_orders_total_nonnegative", sql`${table.totalAmount} >= 0`),
  ],
);

export const paymentsTable = pgTable(
  "farm_connect_payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("demo"),
    transactionReference: text("transaction_reference").notNull(),
    amount: doublePrecision("amount").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("farm_connect_payments_reference_uq").on(table.transactionReference),
    index("farm_connect_payments_order_idx").on(table.orderId),
  ],
);

export const negotiationsTable = pgTable(
  "farm_connect_negotiations",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    buyerId: integer("buyer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    farmerId: integer("farmer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    quantity: doublePrecision("quantity").notNull(),
    proposedPrice: doublePrecision("proposed_price").notNull(),
    status: text("status").notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("farm_connect_negotiations_buyer_idx").on(table.buyerId),
    index("farm_connect_negotiations_farmer_idx").on(table.farmerId),
    check("farm_connect_negotiations_quantity_positive", sql`${table.quantity} > 0`),
    check("farm_connect_negotiations_price_positive", sql`${table.proposedPrice} > 0`),
  ],
);

export const negotiationEventsTable = pgTable(
  "farm_connect_negotiation_events",
  {
    id: serial("id").primaryKey(),
    negotiationId: integer("negotiation_id").notNull().references(() => negotiationsTable.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    proposedPrice: doublePrecision("proposed_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("farm_connect_negotiation_events_parent_idx").on(table.negotiationId)],
);

export const conversationsTable = pgTable(
  "farm_connect_conversations",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    buyerId: integer("buyer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    farmerId: integer("farmer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("farm_connect_conversation_participants_uq").on(table.productId, table.buyerId, table.farmerId),
    index("farm_connect_conversations_buyer_idx").on(table.buyerId),
    index("farm_connect_conversations_farmer_idx").on(table.farmerId),
  ],
);

export const messagesTable = pgTable(
  "farm_connect_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("farm_connect_messages_conversation_idx").on(table.conversationId, table.createdAt)],
);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertNegotiationSchema = createInsertSchema(negotiationsTable).omit({ id: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertNegotiation = z.infer<typeof insertNegotiationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;