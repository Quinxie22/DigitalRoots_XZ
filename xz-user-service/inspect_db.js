const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('xz_chat_db');
    const collections = await db.listCollections().toArray();
    for (const colInfo of collections) {
      console.log(`--- Collection: ${colInfo.name} ---`);
      const docs = await db.collection(colInfo.name).find({}).toArray();
      console.log(docs);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
