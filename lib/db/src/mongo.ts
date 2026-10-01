import {
  MongoClient,
  type ClientSession,
  type Collection,
  type Db,
  type Document,
} from "mongodb";

export const COLLECTIONS = {
  users: "users",
  farms: "farms",
  products: "products",
  orders: "orders",
  payments: "payments",
  negotiations: "negotiations",
  negotiationEvents: "negotiation_events",
  conversations: "conversations",
  messages: "messages",
  uploadClaims: "upload_claims",
  billingFarmerDetails: "billing_farmer_details",
} as const;

export interface MongoUser extends Document {
  id: number;
  clerkId: string;
  displayName: string;
  role: string | null;
  location: string | null;
  businessName: string | null;
  createdAt: Date;
}

export interface MongoFarm extends Document {
  id: number;
  ownerId: number;
  name: string;
  location: string;
  acres: number;
  soilType: string | null;
  irrigation: string | null;
  crops: string[];
  imageUrl: string | null;
  createdAt: Date;
}

export interface MongoProduct extends Document {
  id: number;
  farmId: number | null;
  farmerId: number;
  name: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  location: string;
  organic: boolean;
  quality: string | null;
  harvestDate: string | null;
  cropVariety: string | null;
  plantingDate: string | null;
  cultivationMethod: string | null;
  growthStage: string | null;
  storageNotes: string | null;
  imageUrl: string | null;
  available: boolean;
  createdAt: Date;
}

export interface MongoOrder extends Document {
  id: number;
  productId: number;
  buyerId: number;
  farmerId: number;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface MongoPayment extends Document {
  id: number;
  orderId: number;
  provider: string;
  transactionReference: string;
  amount: number;
  status: string;
  createdAt: Date;
}

export interface MongoNegotiation extends Document {
  id: number;
  productId: number;
  buyerId: number;
  farmerId: number;
  quantity: number;
  proposedPrice: number;
  status: string;
  updatedAt: Date;
}

export interface MongoNegotiationEvent extends Document {
  id: number;
  negotiationId: number;
  actorId: number;
  action: string;
  proposedPrice: number | null;
  createdAt: Date;
}

export interface MongoConversation extends Document {
  id: number;
  productId: number;
  buyerId: number;
  farmerId: number;
  updatedAt: Date;
}

export interface MongoMessage extends Document {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: Date;
}

export interface MongoUploadClaim extends Document {
  objectPath: string;
  ownerId: number;
  name: string;
  size: number;
  contentType: string;
  createdAt: Date;
}

export interface MongoBillingFarmerDetail extends Document {
  id: number;
  businessId: number;
  farmerName: string;
  farmName: string | null;
  gstin: string | null;
  billingAddress: string;
  state: string;
  postalCode: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoCounter extends Document {
  _id: string;
  sequence: number;
}

let client: MongoClient | undefined;
let databasePromise: Promise<Db> | undefined;

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<MongoUser>(COLLECTIONS.users).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoUser>(COLLECTIONS.users).createIndex({ clerkId: 1 }, { unique: true }),
    db.collection<MongoFarm>(COLLECTIONS.farms).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoFarm>(COLLECTIONS.farms).createIndex({ ownerId: 1 }),
    db.collection<MongoProduct>(COLLECTIONS.products).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoProduct>(COLLECTIONS.products).createIndex({ farmerId: 1, available: 1 }),
    db.collection<MongoProduct>(COLLECTIONS.products).createIndex({ category: 1, location: 1 }),
    db.collection<MongoOrder>(COLLECTIONS.orders).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoOrder>(COLLECTIONS.orders).createIndex({ buyerId: 1, createdAt: -1 }),
    db.collection<MongoOrder>(COLLECTIONS.orders).createIndex({ farmerId: 1, createdAt: -1 }),
    db.collection<MongoPayment>(COLLECTIONS.payments).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoPayment>(COLLECTIONS.payments).createIndex({ transactionReference: 1 }, { unique: true }),
    db.collection<MongoPayment>(COLLECTIONS.payments).createIndex({ orderId: 1 }),
    db.collection<MongoNegotiation>(COLLECTIONS.negotiations).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoNegotiation>(COLLECTIONS.negotiations).createIndex({ buyerId: 1, updatedAt: -1 }),
    db.collection<MongoNegotiation>(COLLECTIONS.negotiations).createIndex({ farmerId: 1, updatedAt: -1 }),
    db.collection<MongoNegotiationEvent>(COLLECTIONS.negotiationEvents).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoNegotiationEvent>(COLLECTIONS.negotiationEvents).createIndex({ negotiationId: 1, id: -1 }),
    db.collection<MongoConversation>(COLLECTIONS.conversations).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoConversation>(COLLECTIONS.conversations).createIndex(
      { productId: 1, buyerId: 1, farmerId: 1 },
      { unique: true },
    ),
    db.collection<MongoConversation>(COLLECTIONS.conversations).createIndex({ buyerId: 1, updatedAt: -1 }),
    db.collection<MongoConversation>(COLLECTIONS.conversations).createIndex({ farmerId: 1, updatedAt: -1 }),
    db.collection<MongoMessage>(COLLECTIONS.messages).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoMessage>(COLLECTIONS.messages).createIndex({ conversationId: 1, createdAt: 1 }),
    db.collection<MongoUploadClaim>(COLLECTIONS.uploadClaims).createIndex({ objectPath: 1 }, { unique: true }),
    db.collection<MongoBillingFarmerDetail>(COLLECTIONS.billingFarmerDetails).createIndex({ id: 1 }, { unique: true }),
    db.collection<MongoBillingFarmerDetail>(COLLECTIONS.billingFarmerDetails).createIndex({ businessId: 1, updatedAt: -1 }),
  ]);
}

export async function getMongoDb(): Promise<Db> {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be configured in Replit Secrets.");
  }

  databasePromise ??= (async () => {
    client = new MongoClient(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 10_000,
    });
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || "farm_connect");
    await ensureIndexes(db);
    return db;
  })().catch((error: unknown) => {
    databasePromise = undefined;
    client = undefined;
    throw error;
  });

  return databasePromise;
}

export async function getCollection<T extends Document>(
  collectionName: string,
): Promise<Collection<T>> {
  return (await getMongoDb()).collection<T>(collectionName);
}

export async function nextId(collectionName: string): Promise<number> {
  const db = await getMongoDb();
  const counters = db.collection<MongoCounter>("counters");
  const counter = await counters.findOneAndUpdate(
    { _id: collectionName },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  if (!counter || !Number.isSafeInteger(counter.sequence)) {
    throw new Error(`Unable to allocate a numeric ID for ${collectionName}.`);
  }

  return counter.sequence;
}

export async function withMongoTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await getMongoDb();
  if (!client) {
    throw new Error("MongoDB client is not connected.");
  }

  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
      return result;
    });
    if (result === undefined) {
      throw new Error("MongoDB transaction completed without a result.");
    }
    return result;
  } finally {
    await session.endSession();
  }
}