import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { CompleteMyProfileBody, CompleteMyProfileResponse, GetMyProfileResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { forbidden, getCurrentUser, unauthorized } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  res.json(GetMyProfileResponse.parse({
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    location: user.location,
    businessName: user.businessName,
    createdAt: user.createdAt,
  }));
});

router.put("/me", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized(res);
  const parsed = CompleteMyProfileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid profile details" });
  if (user.role === "admin") return forbidden(res);
  if (user.role && user.role !== parsed.data.role) {
    return res.status(409).json({ error: "Account type cannot be changed after onboarding" });
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      displayName: parsed.data.displayName.trim(),
      location: parsed.data.location.trim(),
      businessName: parsed.data.role === "business" ? (parsed.data.businessName?.trim() || parsed.data.displayName.trim()) : null,
      role: parsed.data.role,
    })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(CompleteMyProfileResponse.parse({
    id: updated.id,
    displayName: updated.displayName,
    role: updated.role,
    location: updated.location,
    businessName: updated.businessName,
    createdAt: updated.createdAt,
  }));
});

export default router;