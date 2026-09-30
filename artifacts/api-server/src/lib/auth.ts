import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

export async function getCurrentUser(req: Request): Promise<User | null> {
  const clerkId = getAuth(req).userId;
  if (!clerkId) return null;

  const configuredAdmins = new Set(
    (process.env.ADMIN_CLERK_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const shouldBeAdmin = configuredAdmins.has(clerkId);
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);

  if (!existing) {
    const [created] = await db
      .insert(usersTable)
      .values({
        clerkId,
        displayName: shouldBeAdmin ? "Farm Connect administrator" : "New member",
        role: shouldBeAdmin ? "admin" : null,
      })
      .onConflictDoNothing({ target: usersTable.clerkId })
      .returning();
    if (created) return created;
    return getCurrentUser(req);
  }

  if (shouldBeAdmin && existing.role !== "admin") {
    const [updated] = await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  return existing;
}

export function unauthorized(res: Response): void {
  res.status(401).json({ error: "Sign-in required" });
}

export function forbidden(res: Response): void {
  res.status(403).json({ error: "This account cannot perform that action" });
}

export function requireRole(user: User, roles: string[]): boolean {
  return user.role !== null && roles.includes(user.role);
}