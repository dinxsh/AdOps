// Quick script to check MongoDB contents
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "ad-bid";

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

async function checkDB() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n=== Collections ===');
    console.log(collections.map(c => c.name));

    // Check each collection
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`\n=== ${collection.name} (${count} documents) ===`);

      if (count > 0) {
        const docs = await db.collection(collection.name).find({}).limit(5).toArray();
        console.log(JSON.stringify(docs, null, 2));
      }
    }

  } finally {
    await client.close();
  }
}

async function clearAdSpotRecords() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('adSpotRecords');

    // Get count before clearing
    const countBefore = await collection.countDocuments();
    console.log(`Found ${countBefore} documents in adSpotRecords collection`);

    if (countBefore > 0) {
      // Clear all documents
      const result = await collection.deleteMany({});
      console.log(`Successfully deleted ${result.deletedCount} documents from adSpotRecords collection`);
    } else {
      console.log('No documents found in adSpotRecords collection');
    }

  } finally {
    await client.close();
  }
}

// Get command line argument to determine which function to run
const command = process.argv[2];

if (command === 'clear') {
  clearAdSpotRecords().catch(console.error);
} else {
  checkDB().catch(console.error);
}
