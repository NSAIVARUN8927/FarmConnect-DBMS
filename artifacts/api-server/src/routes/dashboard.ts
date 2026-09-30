import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetDashboardResponse } from "@workspace/api-zod";
import {
  db,
  farmsTable,
  negotiationsTable,
  ordersTable,
  productsTable,
} from "@workspace/db";
import { getCurrentUser, unauthorized } from "../lib/auth";
import { loadOrdersFor } from "../lib/orders";

const router: IRouter = Router();

router.get("/dashboard", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);

  const isAdmin = user.role === "admin";
  const isFarmer = user.role === "farmer";
  const orderFilter = isAdmin
    ? undefined
    : isFarmer
      ? eq(ordersTable.farmerId, user.id)
      : eq(ordersTable.buyerId, user.id);
  const negotiationFilter = isAdmin
    ? undefined
    : isFarmer
      ? eq(negotiationsTable.farmerId, user.id)
      : eq(negotiationsTable.buyerId, user.id);
  const productFilter = isAdmin
    ? undefined
    : eq(productsTable.farmerId, user.id);
  const farmFilter = isAdmin
    ? undefined
    : eq(farmsTable.ownerId, user.id);

  const [active] = await db.select({ value: count() }).from(ordersTable)
    .where(and(orderFilter, ne(ordersTable.status, "completed"), ne(ordersTable.status, "cancelled")));
  const [completed] = await db.select({ value: count() }).from(ordersTable)
    .where(and(orderFilter, eq(ordersTable.status, "completed")));
  const [listings] = await db.select({ value: count() }).from(productsTable).where(productFilter);
  const [farms] = await db.select({ value: count() }).from(farmsTable).where(farmFilter);
  const [pending] = await db.select({ value: count() }).from(negotiationsTable)
    .where(and(negotiationFilter, inArray(negotiationsTable.status, ["pending", "countered"])));

  const salesFilter = isAdmin
    ? eq(ordersTable.paymentStatus, "successful")
    : isFarmer
      ? and(eq(ordersTable.farmerId, user.id), eq(ordersTable.paymentStatus, "successful"))
      : and(eq(ordersTable.buyerId, user.id), eq(ordersTable.paymentStatus, "successful"));
  const [sales] = await db.select({
    value: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)::float8`,
  }).from(ordersTable).where(salesFilter);
  const recentOrders = await loadOrdersFor(user);

  res.json(GetDashboardResponse.parse({
    role: user.role,
    activeOrders: active.value,
    completedOrders: completed.value,
    listings: isFarmer || isAdmin ? listings.value : 0,
    farms: isFarmer || isAdmin ? farms.value : 0,
    pendingNegotiations: pending.value,
    salesValue: Number(sales.value ?? 0),
    recentOrders: recentOrders.slice(0, 5),
  }));
});

export default router;