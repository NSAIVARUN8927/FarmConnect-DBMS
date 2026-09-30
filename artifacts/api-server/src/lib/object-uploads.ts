import { eq } from "drizzle-orm";
import { db, uploadClaimsTable, type User } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";

const objectStorage = new ObjectStorageService();

export function getPrivateObjectPath(imageUrl: string): string | null {
  try {
    const { pathname } = new URL(imageUrl);
    const marker = "/api/storage/objects/";
    const position = pathname.lastIndexOf(marker);
    if (position < 0) return null;
    const entityPath = pathname.slice(position + marker.length);
    if (!entityPath || entityPath.includes("..")) return null;
    return `/objects/${entityPath}`;
  } catch {
    return null;
  }
}

export async function makeUploadedImagePublic(user: User, imageUrl: string): Promise<boolean> {
  const objectPath = getPrivateObjectPath(imageUrl);
  if (!objectPath) return true;

  const [claim] = await db.select().from(uploadClaimsTable)
    .where(eq(uploadClaimsTable.objectPath, objectPath)).limit(1);
  if (!claim || claim.ownerId !== user.id) return false;

  const file = await objectStorage.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  if (
    Number(metadata.size) !== claim.size ||
    metadata.contentType !== claim.contentType
  ) return false;

  await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
    owner: user.clerkId,
    visibility: "public",
  });
  return true;
}