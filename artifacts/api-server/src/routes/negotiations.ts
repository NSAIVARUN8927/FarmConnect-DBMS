import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateNegotiationBody,
  CreateNegotiationResponse,
  ListNegotiationsResponse,
  RespondToNegotiationBody,
  RespondToNegotiationParams,
  RespondToNegotiationResponse,
} from "@workspace/api-zod";
import {
  db,
  negotiationEventsTable,
  negotiationsTable,
  ordersTable,
  productsTable,
  usersTable,
} from "@workspace/db";
import { forbidden, getCurrentUser, requireRole, unauthorized } from "../lib/auth";

const router: IRouter = Router();
const buyers = alias(usersTable, "negotiation_buyers");
const farmers = alias(usersTable, "negotiation_farmers");

async function loadNegotiation(id: number) {
  const [row] = await db
    .select({
      negotiation: negotiationsTable,
      productName: productsTable.name,
      unit: productsTable.unit,
      buyerName: buyers.displayName,
      farmerName: farmers.displayName,
    })
    .from(negotiationsTable)
    .innerJoin(productsTable, eq(negotiationsTable.productId, productsTable.id))
    .innerJoin(buyers, eq(negotiationsTable.buyerId, buyers.id))
    .innerJoin(farmers, eq(negotiationsTable.farmerId, farmers.id))
    .where(eq(negotiationsTable.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.negotiation.id,
    productId: row.negotiation.productId,
    productName: row.productName,
    buyerId: row.negotiation.buyerId,
    buyerName: row.buyerName,
    farmerId: row.negotiation.farmerId,
    farmerName: row.farmerName,
    quantity: row.negotiation.quantity,
    unit: row.unit,
    proposedPrice: row.negotiation.proposedPrice,
    status: row.negotiation.status,
    updatedAt: row.negotiation.updatedAt,
  };
}

router.get("/negotiations", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer", "business", "admin"])) return forbidden(res);
  const conditions = user.role === "admin"
    ? undefined
    : user.role === "farmer"
      ? eq(negotiationsTable.farmerId, user.id)
      : eq(negotiationsTable.buyerId, user.id);
  const rows = await db
    .select({
      negotiation: negotiationsTable,
      productName: productsTable.name,
      unit: productsTable.unit,
      buyerName: buyers.displayName,
      farmerName: farmers.displayName,
    })
    .from(negotiationsTable)
    .innerJoin(productsTable, eq(negotiationsTable.productId, productsTable.id))
    .innerJoin(buyers, eq(negotiationsTable.buyerId, buyers.id))
    .innerJoin(farmers, eq(negotiationsTable.farmerId, farmers.id))
    .where(conditions)
    .orderBy(desc(negotiationsTable.updatedAt));
  res.json(ListNegotiationsResponse.parse(rows.map((row) => ({
    id: row.negotiation.id,
    productId: row.negotiation.productId,
    productName: row.productName,
    buyerId: row.negotiation.buyerId,
    buyerName: row.buyerName,
    farmerId: row.negotiation.farmerId,
    farmerName: row.farmerName,
    quantity: row.negotiation.quantity,
    unit: row.unit,
    proposedPrice: row.negotiation.proposedPrice,
    status: row.negotiation.status,
    updatedAt: row.negotiation.updatedAt,
  }))));
});

router.post("/negotiations", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["business"])) return forbidden(res);
  const body = CreateNegotiationBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid offer" });

  const createdId = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable)
      .where(and(eq(productsTable.id, body.data.productId), eq(productsTable.available, true)))
      .limit(1);
    if (!product || product.farmerId === user.id || product.quantity < body.data.quantity) return null;
    const [negotiation] = await tx.insert(negotiationsTable).values({
      productId: product.id,
      buyerId: user.id,
      farmerId: product.farmerId,
      quantity: body.data.quantity,
      proposedPrice: body.data.proposedPrice,
      status: "pending",
    }).returning({ id: negotiationsTable.id });
    await tx.insert(negotiationEventsTable).values({
      negotiationId: negotiation.id,
      actorId: user.id,
      action: "proposed",
      proposedPrice: body.data.proposedPrice,
    });
    return negotiation.id;
  });
  if (!createdId) return res.status(400).json({ error: "Product is unavailable or the requested quantity exceeds stock" });
  res.status(201).json(CreateNegotiationResponse.parse(await loadNegotiation(createdId)));
});

router.patch("/negotiations/:negotiationId", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer", "business"])) return forbidden(res);
  const params = RespondToNegotiationParams.safeParse(req.params);
  const body = RespondToNegotiationBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid negotiation response" });

  const negotiationId = params.data.negotiationId;
  const changed = await db.transaction(async (tx) => {
    const [negotiation] = await tx.select().from(negotiationsTable)
      .where(eq(negotiationsTable.id, negotiationId)).for("update").limit(1);
    if (!negotiation) return "missing" as const;
    const participant = user.id === negotiation.buyerId || user.id === negotiation.farmerId;
    if (!participant) return "forbidden" as const;
    if (!["pending", "countered"].includes(negotiation.status)) return "closed" as const;
    const [lastEvent] = await tx.select().from(negotiationEventsTable)
      .where(eq(negotiationEventsTable.negotiationId, negotiation.id))
      .orderBy(desc(negotiationEventsTable.id)).limit(1);
    if (lastEvent?.actorId === user.id) return "turn" as const;

    const action = body.data.action;
    if (action === "counter") {
      if (body.data.proposedPrice == null) return "price" as const;
      await tx.update(negotiationsTable).set({
        proposedPrice: body.data.proposedPrice,
        status: "countered",
        updatedAt: new Date(),
      }).where(eq(negotiationsTable.id, negotiation.id));
      await tx.insert(negotiationEventsTable).values({
        negotiationId: negotiation.id,
        actorId: user.id,
        action: "counter",
        proposedPrice: body.data.proposedPrice,
      });
      return "updated" as const;
    }

    await tx.update(negotiationsTable).set({
      status: action === "accept" ? "accepted" : "rejected",
      updatedAt: new Date(),
    }).where(eq(negotiationsTable.id, negotiation.id));
    await tx.insert(negotiationEventsTable).values({
      negotiationId: negotiation.id,
      actorId: user.id,
      action,
      proposedPrice: negotiation.proposedPrice,
    });

    if (action === "accept") {
      const [product] = await tx.select().from(productsTable)
        .where(and(eq(productsTable.id, negotiation.productId), eq(productsTable.available, true)))
        .limit(1);
      if (!product || product.quantity < negotiation.quantity) return "stock" as const;
      const [reserved] = await tx.update(productsTable).set({
        quantity: sql`${productsTable.quantity} - ${negotiation.quantity}`,
        available: sql`${productsTable.quantity} - ${negotiation.quantity} > 0`,
      }).where(and(eq(productsTable.id, product.id), gte(productsTable.quantity, negotiation.quantity)))
        .returning({ id: productsTable.id });
      if (!reserved) return "stock" as const;
      await tx.insert(ordersTable).values({
        productId: product.id,
        buyerId: negotiation.buyerId,
        farmerId: negotiation.farmerId,
        quantity: negotiation.quantity,
        unit: product.unit,
        pricePerUnit: negotiation.proposedPrice,
        totalAmount: negotiation.proposedPrice * negotiation.quantity,
        status: "payment_pending",
        paymentStatus: "pending",
        notes: `Accepted negotiated price. Offer #${negotiation.id}`,
      });
    }
    return "updated" as const;
  });

  if (changed === "missing") return res.status(404).json({ error: "Negotiation not found" });
  if (changed === "forbidden") return forbidden(res);
  if (changed === "closed") return res.status(409).json({ error: "This negotiation is closed" });
  if (changed === "turn") return res.status(409).json({ error: "Wait for the other party to respond" });
  if (changed === "price") return res.status(400).json({ error: "A counteroffer price is required" });
  if (changed === "stock") return res.status(409).json({ error: "The requested quantity is no longer available" });
  res.json(RespondToNegotiationResponse.parse(await loadNegotiation(negotiationId)));
});

export default router;