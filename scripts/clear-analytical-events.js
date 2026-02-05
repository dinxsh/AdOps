// Script to clear analyticalEvents collection
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "ad-bid";

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

async function clearAnalyticalEvents() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('analyticalEvents');

    // Get count before deletion
    const countBefore = await collection.countDocuments();
    console.log(`📊 Found ${countBefore} documents in analyticalEvents`);

    // Delete all documents
    const result = await collection.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} documents`);

    // Verify empty
    const countAfter = await collection.countDocuments();
    console.log(`✨ Collection now has ${countAfter} documents`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

async function clearAdSpotRecords() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('adSpotRecords');

    // Get count before deletion
    const countBefore = await collection.countDocuments();
    console.log(`📊 Found ${countBefore} documents in adSpotRecords`);

    // Delete all documents
    const result = await collection.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} documents`);

    // Verify empty
    const countAfter = await collection.countDocuments();
    console.log(`✨ Collection now has ${countAfter} documents`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

async function clearAll() {
  console.log('🧹 Starting database cleanup...\n');
  
  await clearAnalyticalEvents();
  console.log('\n');
  await clearAdSpotRecords();
  
  console.log('\n🎉 Database cleanup completed!');
}

clearAll();
