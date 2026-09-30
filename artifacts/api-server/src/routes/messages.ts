import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ListConversationsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  SendMessageBody,
  SendMessageParams,
  SendMessageResponse,
  StartConversationBody,
  StartConversationResponse,
} from "@workspace/api-zod";
import { db, conversationsTable, messagesTable, productsTable, usersTable } from "@workspace/db";
import { forbidden, getCurrentUser, requireRole, unauthorized } from "../lib/auth";

const router: IRouter = Router();
const buyers = alias(usersTable, "conversation_buyers");
const farmers = alias(usersTable, "conversation_farmers");

function conversationQuery() {
  return db
    .select({
      conversation: conversationsTable,
      productName: productsTable.name,
      buyerName: buyers.displayName,
      farmerName: farmers.displayName,
    })
    .from(conversationsTable)
    .innerJoin(productsTable, eq(conversationsTable.productId, productsTable.id))
    .innerJoin(buyers, eq(conversationsTable.buyerId, buyers.id))
    .innerJoin(farmers, eq(conversationsTable.farmerId, farmers.id));
}

router.get("/conversations", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer", "business", "admin"])) return forbidden(res);
  const rows = await conversationQuery()
    .where(user.role === "admin"
      ? undefined
      : or(eq(conversationsTable.buyerId, user.id), eq(conversationsTable.farmerId, user.id)))
    .orderBy(desc(conversationsTable.updatedAt));
  res.json(ListConversationsResponse.parse(rows.map((row) => ({
    id: row.conversation.id,
    productId: row.conversation.productId,
    productName: row.productName,
    otherUserName: row.conversation.buyerId === user.id ? row.farmerName : row.buyerName,
    updatedAt: row.conversation.updatedAt,
  }))));
});

router.post("/conversations", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["business"])) return forbidden(res);
  const body = StartConversationBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid conversation request" });
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, body.data.productId), eq(productsTable.available, true))).limit(1);
  if (!product || product.farmerId === user.id) return res.status(404).json({ error: "Product not found" });

  let [conversation] = await db.select().from(conversationsTable)
    .where(and(
      eq(conversationsTable.productId, product.id),
      eq(conversationsTable.buyerId, user.id),
      eq(conversationsTable.farmerId, product.farmerId),
    )).limit(1);
  if (!conversation) {
    const [created] = await db.insert(conversationsTable).values({
      productId: product.id,
      buyerId: user.id,
      farmerId: product.farmerId,
    }).onConflictDoNothing().returning();
    conversation = created ?? (await db.select().from(conversationsTable).where(and(
      eq(conversationsTable.productId, product.id),
      eq(conversationsTable.buyerId, user.id),
      eq(conversationsTable.farmerId, product.farmerId),
    )).limit(1))[0];
  }
  if (!conversation) return res.status(500).json({ error: "Conversation could not be created" });
  const [farmer] = await db.select().from(usersTable).where(eq(usersTable.id, product.farmerId)).limit(1);
  res.status(201).json(StartConversationResponse.parse({
    id: conversation.id,
    productId: product.id,
    productName: product.name,
    otherUserName: farmer?.displayName ?? "Farmer",
    updatedAt: conversation.updatedAt,
  }));
});

router.get("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid conversation ID" });
  const [conversation] = await db.select({ id: conversationsTable.id }).from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, params.data.conversationId),
      or(eq(conversationsTable.buyerId, user.id), eq(conversationsTable.farmerId, user.id)),
    )).limit(1);
  if (!conversation) return forbidden(res);
  const rows = await db.select({
    id: messagesTable.id,
    senderId: messagesTable.senderId,
    senderName: usersTable.displayName,
    body: messagesTable.body,
    createdAt: messagesTable.createdAt,
  }).from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(asc(messagesTable.createdAt));
  res.json(ListMessagesResponse.parse(rows));
});

router.post("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  const params = SendMessageParams.safeParse(req.params);
  const body = SendMessageBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid message" });
  const [conversation] = await db.select({ id: conversationsTable.id }).from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, params.data.conversationId),
      or(eq(conversationsTable.buyerId, user.id), eq(conversationsTable.farmerId, user.id)),
    )).limit(1);
  if (!conversation) return forbidden(res);

  const [message] = await db.insert(messagesTable).values({
    conversationId: conversation.id,
    senderId: user.id,
    body: body.data.body.trim(),
  }).returning();
  await db.update(conversationsTable).set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversation.id));
  res.status(201).json(SendMessageResponse.parse({
    id: message.id,
    senderId: user.id,
    senderName: user.displayName,
    body: message.body,
    createdAt: message.createdAt,
  }));
});

export default router;