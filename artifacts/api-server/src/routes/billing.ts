import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateBillingFarmerDetailsBody,
  CreateBillingFarmerDetailsResponse,
  DeleteBillingFarmerDetailsParams,
  ListBillingFarmerDetailsResponse,
  UpdateBillingFarmerDetailsBody,
  UpdateBillingFarmerDetailsParams,
  UpdateBillingFarmerDetailsResponse,
} from "@workspace/api-zod";
import { billingFarmerDetailsTable, db } from "@workspace/db";
import { forbidden, getCurrentUser, requireRole, unauthorized } from "../lib/auth";

const router: IRouter = Router();

function serializeRecord(record: typeof billingFarmerDetailsTable.$inferSelect) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function normalizeRecordInput(input: {
  farmerName: string;
  farmName?: string | null;
  gstin?: string | null;
  billingAddress: string;
  state: string;
  postalCode: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}) {
  return {
    farmerName: input.farmerName.trim(),
    farmName: input.farmName?.trim() || null,
    gstin: input.gstin?.trim().toUpperCase() || null,
    billingAddress: input.billingAddress.trim(),
    state: input.state.trim(),
    postalCode: input.postalCode.trim(),
    contactPhone: input.contactPhone?.trim() || null,
    contactEmail: input.contactEmail?.trim().toLowerCase() || null,
    notes: input.notes?.trim() || null,
  };
}

router.get("/billing/farmer-details", async (req: Request, res: Response): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    unauthorized(res);
    return;
  }
  if (!requireRole(user, ["business"])) {
    forbidden(res);
    return;
  }

  const rows = await db.select().from(billingFarmerDetailsTable)
    .where(eq(billingFarmerDetailsTable.businessId, user.id))
    .orderBy(desc(billingFarmerDetailsTable.updatedAt), desc(billingFarmerDetailsTable.id));
  res.json(ListBillingFarmerDetailsResponse.parse(rows.map(serializeRecord)));
});

router.post("/billing/farmer-details", async (req: Request, res: Response): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    unauthorized(res);
    return;
  }
  if (!requireRole(user, ["business"])) {
    forbidden(res);
    return;
  }
  const body = CreateBillingFarmerDetailsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid farmer billing details" });
    return;
  }

  const [record] = await db.insert(billingFarmerDetailsTable).values({
    businessId: user.id,
    ...normalizeRecordInput(body.data),
  }).returning();
  res.status(201).json(CreateBillingFarmerDetailsResponse.parse(serializeRecord(record)));
});

router.patch("/billing/farmer-details/:billingDetailsId", async (req: Request, res: Response): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    unauthorized(res);
    return;
  }
  if (!requireRole(user, ["business"])) {
    forbidden(res);
    return;
  }
  const params = UpdateBillingFarmerDetailsParams.safeParse(req.params);
  const body = UpdateBillingFarmerDetailsBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid farmer billing update" });
    return;
  }

  const patch = body.data;
  const [record] = await db.update(billingFarmerDetailsTable).set({
    ...(patch.farmerName !== undefined ? { farmerName: patch.farmerName.trim() } : {}),
    ...(patch.farmName !== undefined ? { farmName: patch.farmName?.trim() || null } : {}),
    ...(patch.gstin !== undefined ? { gstin: patch.gstin?.trim().toUpperCase() || null } : {}),
    ...(patch.billingAddress !== undefined ? { billingAddress: patch.billingAddress.trim() } : {}),
    ...(patch.state !== undefined ? { state: patch.state.trim() } : {}),
    ...(patch.postalCode !== undefined ? { postalCode: patch.postalCode.trim() } : {}),
    ...(patch.contactPhone !== undefined ? { contactPhone: patch.contactPhone?.trim() || null } : {}),
    ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail?.trim().toLowerCase() || null } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(billingFarmerDetailsTable.id, params.data.billingDetailsId),
    eq(billingFarmerDetailsTable.businessId, user.id),
  )).returning();
  if (!record) {
    res.status(404).json({ error: "Billing record not found" });
    return;
  }
  res.json(UpdateBillingFarmerDetailsResponse.parse(serializeRecord(record)));
});

router.delete("/billing/farmer-details/:billingDetailsId", async (req: Request, res: Response): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    unauthorized(res);
    return;
  }
  if (!requireRole(user, ["business"])) {
    forbidden(res);
    return;
  }
  const params = DeleteBillingFarmerDetailsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid billing record ID" });
    return;
  }

  const [deleted] = await db.delete(billingFarmerDetailsTable).where(and(
    eq(billingFarmerDetailsTable.id, params.data.billingDetailsId),
    eq(billingFarmerDetailsTable.businessId, user.id),
  )).returning({ id: billingFarmerDetailsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Billing record not found" });
    return;
  }
  res.status(204).end();
});

export default router;