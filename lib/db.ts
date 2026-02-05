import { MongoClient, Db } from 'mongodb';
import { AdSpotRecord } from '@/types';

let client: MongoClient;
let db: Db;

export async function connectToDatabase() {
  if (db) {
    return { client, db };
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  if (!dbName) {
    throw new Error('MONGODB_DB_NAME is not defined in environment variables');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  console.log(`Connected to MongoDB database: ${dbName}`);

  return { client, db };
}

// Ad Spot functions (new)
export async function getAdSpotRecord(adSpotId: string): Promise<AdSpotRecord | null> {
  const { db } = await connectToDatabase();
  return db.collection<AdSpotRecord>('adSpotRecords').findOne({ adSpotId });
}

export async function updateAdSpotRecord(
  adSpotId: string,
  update: Partial<AdSpotRecord>
): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection<AdSpotRecord>('adSpotRecords').updateOne(
    { adSpotId },
    {
      $set: { ...update, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
}

export async function addBidToHistory(
  adSpotId: string,
  bid: AdSpotRecord['bidHistory'][0]
): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection<AdSpotRecord>('adSpotRecords').updateOne(
    { adSpotId },
    {
      $push: { bidHistory: bid },
      $set: { updatedAt: new Date() }
    }
  );
}

// Event storage for complete observability
export interface StoredEvent {
  adSpotId: string;
  event: Record<string, unknown>;
  timestamp: Date;
}

export async function storeEvent(adSpotId: string, event: Record<string, unknown>): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection<StoredEvent>('analyticalEvents').insertOne({
      adSpotId,
      event,
      timestamp: new Date()
    });
    console.log(`💾 [DB] ✅ Stored event for ${adSpotId}:`, event.type);
  } catch (error) {
    // Log error but don't throw - we don't want to break the event flow
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`💾 [DB] ❌ Failed to store event for ${adSpotId}:`, event.type, errorMessage);
  }
}

export async function getStoredEvents(adSpotId: string, since?: Date): Promise<StoredEvent[]> {
  const { db } = await connectToDatabase();
  const query: Record<string, unknown> = { adSpotId };
  if (since) {
    query.timestamp = { $gte: since };
  }
  const events = await db.collection<StoredEvent>('analyticalEvents')
    .find(query)
    .sort({ timestamp: 1 })
    .toArray();
  console.log(`📖 [DB] Retrieved ${events.length} stored events for ${adSpotId}`);
  return events;
}
