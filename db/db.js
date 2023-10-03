const { MongoClient } = require('mongodb');

// Connect to MongoDB
const uri = process.env.mongo_host;
const dbName = 'inventoryman';


async function connectToMongo() {
    // Create a Mongo client
    const client = new MongoClient(uri, { useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
    console.log('Db connected');
    return db;
}

module.exports = { connectToMongo };