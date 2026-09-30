import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateFarmBody,
  CreateFarmResponse,
  DeleteFarmParams,
  ListFarmsResponse,
  UpdateFarmBody,
  UpdateFarmParams,
  UpdateFarmResponse,
} from "@workspace/api-zod";
import { db, farmsTable } from "@workspace/db";
import { forbidden, getCurrentUser, requireRole, unauthorized } from "../lib/auth";

const router: IRouter = Router();

function serializeFarm(farm: typeof farmsTable.$inferSelect) {
  return {
    id: farm.id,
    name: farm.name,
    location: farm.location,
    acres: farm.acres,
    soilType: farm.soilType,
    irrigation: farm.irrigation,
    crops: farm.crops,
    imageUrl: farm.imageUrl,
    createdAt: farm.createdAt,
  };
}

router.get("/farms", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer", "admin"])) return forbidden(res);
  const rows = user.role === "admin"
    ? await db.select().from(farmsTable).orderBy(asc(farmsTable.createdAt))
    : await db.select().from(farmsTable).where(eq(farmsTable.ownerId, user.id)).orderBy(asc(farmsTable.createdAt));
  res.json(ListFarmsResponse.parse(rows.map(serializeFarm)));
});

router.post("/farms", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer"])) return forbidden(res);
  const parsed = CreateFarmBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid farm details" });
  const [farm] = await db.insert(farmsTable).values({
    ownerId: user.id,
    ...parsed.data,
    crops: parsed.data.crops ?? [],
    soilType: parsed.data.soilType ?? null,
    irrigation: parsed.data.irrigation ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
  }).returning();
  res.status(201).json(CreateFarmResponse.parse(serializeFarm(farm)));
});

router.patch("/farms/:farmId", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer"])) return forbidden(res);
  const params = UpdateFarmParams.safeParse(req.params);
  const body = UpdateFarmBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid farm update" });
  const [farm] = await db.update(farmsTable)
    .set(body.data)
    .where(and(eq(farmsTable.id, params.data.farmId), eq(farmsTable.ownerId, user.id)))
    .returning();
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  res.json(UpdateFarmResponse.parse(serializeFarm(farm)));
});

router.delete("/farms/:farmId", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer"])) return forbidden(res);
  const params = DeleteFarmParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid farm ID" });
  const [farm] = await db.delete(farmsTable)
    .where(and(eq(farmsTable.id, params.data.farmId), eq(farmsTable.ownerId, user.id)))
    .returning({ id: farmsTable.id });
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  res.status(204).end();
});

export default router;