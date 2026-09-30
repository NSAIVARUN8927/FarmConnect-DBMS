import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, ordersTable, productsTable, usersTable, type User } from "@workspace/db";

const buyers = alias(usersTable, "order_buyers");
const farmers = alias(usersTable, "order_farmers");

export async function loadOrdersFor(user: User) {
  const conditions = user.role === "admin"
    ? undefined
    : user.role === "farmer"
      ? eq(ordersTable.farmerId, user.id)
      : eq(ordersTable.buyerId, user.id);
  const rows = await db
    .select({
      order: ordersTable,
      productName: productsTable.name,
      buyerName: buyers.displayName,
      farmerName: farmers.displayName,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .innerJoin(buyers, eq(ordersTable.buyerId, buyers.id))
    .innerJoin(farmers, eq(ordersTable.farmerId, farmers.id))
    .where(conditions)
    .orderBy(desc(ordersTable.createdAt));
  return rows.map(({ order, productName, buyerName, farmerName }) => ({
    id: order.id,
    productId: order.productId,
    productName,
    buyerId: order.buyerId,
    buyerName,
    farmerId: order.farmerId,
    farmerName,
    quantity: order.quantity,
    unit: order.unit,
    pricePerUnit: order.pricePerUnit,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentReference: order.paymentReference,
    notes: order.notes,
    createdAt: order.createdAt,
  }));
}

export async function loadOrderById(orderId: number) {
  const [row] = await db
    .select({
      order: ordersTable,
      productName: productsTable.name,
      buyerName: buyers.displayName,
      farmerName: farmers.displayName,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .innerJoin(buyers, eq(ordersTable.buyerId, buyers.id))
    .innerJoin(farmers, eq(ordersTable.farmerId, farmers.id))
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.order.id,
    productId: row.order.productId,
    productName: row.productName,
    buyerId: row.order.buyerId,
    buyerName: row.buyerName,
    farmerId: row.order.farmerId,
    farmerName: row.farmerName,
    quantity: row.order.quantity,
    unit: row.order.unit,
    pricePerUnit: row.order.pricePerUnit,
    totalAmount: row.order.totalAmount,
    status: row.order.status,
    paymentStatus: row.order.paymentStatus,
    paymentReference: row.order.paymentReference,
    notes: row.order.notes,
    createdAt: row.order.createdAt,
  };
}