import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateDemoPaymentParams,
  CreateDemoPaymentResponse,
  CreateOrderBody,
  CreateOrderResponse,
  ListOrdersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import { db, ordersTable, paymentsTable, productsTable, type User } from "@workspace/db";
import { forbidden, getCurrentUser, requireRole, unauthorized } from "../lib/auth";
import { loadOrderById, loadOrdersFor } from "../lib/orders";

const router: IRouter = Router();
const terminalStatuses = new Set(["completed", "cancelled"]);

router.get("/orders", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer", "business", "admin"])) return forbidden(res);
  res.json(ListOrdersResponse.parse(await loadOrdersFor(user)));
});

router.post("/orders", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["business"])) return forbidden(res);
  const body = CreateOrderBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid order details" });

  const orderId = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable)
      .where(and(eq(productsTable.id, body.data.productId), eq(productsTable.available, true))).limit(1);
    if (!product || product.farmerId === user.id || product.quantity < body.data.quantity) return null;
    const [reserved] = await tx.update(productsTable)
      .set({
        quantity: sql`${productsTable.quantity} - ${body.data.quantity}`,
        available: sql`${productsTable.quantity} - ${body.data.quantity} > 0`,
      })
      .where(and(eq(productsTable.id, product.id), gte(productsTable.quantity, body.data.quantity)))
      .returning({ id: productsTable.id });
    if (!reserved) return null;
    const [order] = await tx.insert(ordersTable).values({
      productId: product.id,
      buyerId: user.id,
      farmerId: product.farmerId,
      quantity: body.data.quantity,
      unit: product.unit,
      pricePerUnit: product.pricePerUnit,
      totalAmount: product.pricePerUnit * body.data.quantity,
      status: "payment_pending",
      paymentStatus: "pending",
      notes: body.data.notes ?? null,
    }).returning({ id: ordersTable.id });
    return order.id;
  });
  if (!orderId) return res.status(400).json({ error: "Product is unavailable or the quantity exceeds current stock" });
  const order = await loadOrderById(orderId);
  res.status(201).json(CreateOrderResponse.parse(order));
});

router.patch("/orders/:orderId/status", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid order update" });

  const current = await loadOrderById(params.data.orderId);
  if (!current) return res.status(404).json({ error: "Order not found" });
  const target = body.data.status;
  const isBuyer = current.buyerId === user.id && user.role === "business";
  const isFarmer = current.farmerId === user.id && user.role === "farmer";
  const isAdmin = user.role === "admin";
  if (!isBuyer && !isFarmer && !isAdmin) return forbidden(res);
  if (terminalStatuses.has(current.status)) return res.status(409).json({ error: "This order is already closed" });

  if (target === "cancelled") {
    if (!isAdmin && (!isBuyer || current.paymentStatus !== "pending")) {
      return res.status(409).json({ error: "Only the buyer can cancel an unpaid order" });
    }
    await db.transaction(async (tx) => {
      await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, current.id));
      await tx.update(productsTable).set({
        quantity: sql`${productsTable.quantity} + ${current.quantity}`,
        available: true,
      }).where(eq(productsTable.id, current.productId));
    });
  } else {
    const farmerSequence = ["confirmed", "processing", "ready", "completed"];
    if (!isFarmer && !isAdmin) return forbidden(res);
    if (current.paymentStatus !== "successful") return res.status(409).json({ error: "A successful payment is required before fulfillment" });
    if (!isAdmin && farmerSequence.indexOf(target) !== farmerSequence.indexOf(current.status) + 1) {
      return res.status(409).json({ error: "Order status must advance one step at a time" });
    }
    await db.update(ordersTable).set({ status: target }).where(eq(ordersTable.id, current.id));
  }
  const updated = await loadOrderById(current.id);
  res.json(UpdateOrderStatusResponse.parse(updated));
});

router.post("/orders/:orderId/demo-payment", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["business"])) return forbidden(res);
  const params = CreateDemoPaymentParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid order ID" });
  const reference = `DEMO-${randomUUID()}`;

  const paid = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(ordersTable)
      .where(and(eq(ordersTable.id, params.data.orderId), eq(ordersTable.buyerId, user.id)))
      .limit(1);
    if (!order || order.paymentStatus !== "pending" || order.status !== "payment_pending") return false;
    await tx.insert(paymentsTable).values({
      orderId: order.id,
      provider: "demo",
      transactionReference: reference,
      amount: order.totalAmount,
      status: "successful",
    });
    await tx.update(ordersTable).set({
      paymentStatus: "successful",
      paymentReference: reference,
      status: "confirmed",
    }).where(eq(ordersTable.id, order.id));
    return true;
  });
  if (!paid) return res.status(404).json({ error: "Pending order not found" });
  const updated = await loadOrderById(params.data.orderId);
  res.json(CreateDemoPaymentResponse.parse(updated));
});

export default router;