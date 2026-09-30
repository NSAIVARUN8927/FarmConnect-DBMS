import { and, asc, count, desc, eq, gte, ilike, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateProductBody,
  CreateProductResponse,
  DeleteProductParams,
  GetMarketplaceOverviewResponse,
  GetProductParams,
  GetProductResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { db, farmsTable, ordersTable, productsTable, usersTable } from "@workspace/db";
import { forbidden, getCurrentUser, requireRole, unauthorized } from "../lib/auth";

const router: IRouter = Router();

function serializeProduct(
  product: typeof productsTable.$inferSelect,
  farmerName: string,
  farmName: string | null,
) {
  return {
    id: product.id,
    farmId: product.farmId,
    farmerId: product.farmerId,
    farmerName,
    farmName,
    name: product.name,
    category: product.category,
    description: product.description,
    unit: product.unit,
    quantity: product.quantity,
    pricePerUnit: product.pricePerUnit,
    location: product.location,
    organic: product.organic,
    quality: product.quality,
    harvestDate: product.harvestDate,
    imageUrl: product.imageUrl,
    available: product.available,
    createdAt: product.createdAt,
  };
}

async function loadProduct(productId: number) {
  const [row] = await db
    .select({ product: productsTable, farmerName: usersTable.displayName, farmName: farmsTable.name })
    .from(productsTable)
    .innerJoin(usersTable, eq(productsTable.farmerId, usersTable.id))
    .leftJoin(farmsTable, eq(productsTable.farmId, farmsTable.id))
    .where(eq(productsTable.id, productId))
    .limit(1);
  return row ? serializeProduct(row.product, row.farmerName, row.farmName) : null;
}

router.get("/marketplace/overview", async (_req: Request, res: Response) => {
  const [farmers] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.role, "farmer"));
  const [businesses] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.role, "business"));
  const [products] = await db.select({ value: count() }).from(productsTable).where(and(eq(productsTable.available, true), gte(productsTable.quantity, 0.01)));
  const [transactions] = await db.select({ value: count() }).from(ordersTable).where(eq(ordersTable.status, "completed"));
  const featuredRows = await db
    .select({ product: productsTable, farmerName: usersTable.displayName, farmName: farmsTable.name })
    .from(productsTable)
    .innerJoin(usersTable, eq(productsTable.farmerId, usersTable.id))
    .leftJoin(farmsTable, eq(productsTable.farmId, farmsTable.id))
    .where(and(eq(productsTable.available, true), gte(productsTable.quantity, 0.01)))
    .orderBy(desc(productsTable.createdAt))
    .limit(4);
  res.json(GetMarketplaceOverviewResponse.parse({
    farmers: farmers.value,
    businesses: businesses.value,
    products: products.value,
    transactions: transactions.value,
    featuredProducts: featuredRows.map((row) => serializeProduct(row.product, row.farmerName, row.farmName)),
  }));
});

router.get("/products", async (req: Request, res: Response) => {
  const query = ListProductsQueryParams.safeParse({
    ...req.query,
    organic: typeof req.query.organic === "string" ? req.query.organic === "true" : req.query.organic,
  });
  if (!query.success) {
    res.status(400).json({ error: "Invalid search filters" });
    return;
  }

  const filters = [eq(productsTable.available, true), gte(productsTable.quantity, 0.01)];
  if (query.data.search) filters.push(ilike(productsTable.name, `%${query.data.search}%`));
  if (query.data.category) filters.push(eq(productsTable.category, query.data.category));
  if (query.data.location) filters.push(ilike(productsTable.location, `%${query.data.location}%`));
  if (query.data.organic !== undefined) filters.push(eq(productsTable.organic, query.data.organic));

  const rows = await db
    .select({ product: productsTable, farmerName: usersTable.displayName, farmName: farmsTable.name })
    .from(productsTable)
    .innerJoin(usersTable, eq(productsTable.farmerId, usersTable.id))
    .leftJoin(farmsTable, eq(productsTable.farmId, farmsTable.id))
    .where(and(...filters))
    .orderBy(desc(productsTable.createdAt))
    .limit(query.data.limit ?? 24)
    .offset(query.data.offset ?? 0);
  return res.json(ListProductsResponse.parse(rows.map((row) => serializeProduct(row.product, row.farmerName, row.farmName))));
});

router.get("/products/:productId", async (req: Request, res: Response) => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }
  const product = await loadProduct(params.data.productId);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  return res.json(GetProductResponse.parse(product));
});

router.post("/products", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer"])) return forbidden(res);
  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid product details" });
  if (body.data.farmId) {
    const [farm] = await db.select({ id: farmsTable.id }).from(farmsTable)
      .where(and(eq(farmsTable.id, body.data.farmId), eq(farmsTable.ownerId, user.id))).limit(1);
    if (!farm) return res.status(400).json({ error: "Choose a farm you own" });
  }
  const { harvestDate, ...productInput } = body.data;
  const [product] = await db.insert(productsTable).values({
    farmerId: user.id,
    ...productInput,
    farmId: productInput.farmId ?? null,
    quality: productInput.quality ?? null,
    harvestDate: harvestDate ? harvestDate.toISOString().slice(0, 10) : null,
    imageUrl: productInput.imageUrl ?? null,
    description: productInput.description ?? "",
    unit: productInput.unit ?? "kg",
  }).returning();
  const response = await loadProduct(product.id);
  res.status(201).json(CreateProductResponse.parse(response));
});

router.patch("/products/:productId", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer"])) return forbidden(res);
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid product update" });

  if (body.data.farmId) {
    const [farm] = await db.select({ id: farmsTable.id }).from(farmsTable)
      .where(and(eq(farmsTable.id, body.data.farmId), eq(farmsTable.ownerId, user.id))).limit(1);
    if (!farm) return res.status(400).json({ error: "Choose a farm you own" });
  }

  const { harvestDate, ...productChanges } = body.data;
  const [updated] = await db.update(productsTable)
    .set(harvestDate === undefined
      ? productChanges
      : { ...productChanges, harvestDate: harvestDate ? harvestDate.toISOString().slice(0, 10) : null })
    .where(and(eq(productsTable.id, params.data.productId), eq(productsTable.farmerId, user.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Product not found" });
  const response = await loadProduct(updated.id);
  res.json(UpdateProductResponse.parse(response));
});

router.delete("/products/:productId", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  if (!requireRole(user, ["farmer"])) return forbidden(res);
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid product ID" });
  const [deleted] = await db.delete(productsTable)
    .where(and(eq(productsTable.id, params.data.productId), eq(productsTable.farmerId, user.id)))
    .returning({ id: productsTable.id });
  if (!deleted) return res.status(404).json({ error: "Product not found" });
  res.status(204).end();
});

export default router;