const { MongoClient } = require('mongodb');

// Database connection URI
const uri = process.env.npm_config_mongo_host;

// Create a Mongo client
const client = new MongoClient(uri, { useUnifiedTopology: true });

// Connect to the database
async function connect() {
    console.log("here i am");
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error(err);
        throw err;
    }
}

// Get the database instance
function getDatabase(dbname) {
    return client.db(dbname);
}

// Close the connection
async function close() {
    await client.close();
    console.log('Disconnected from MongoDB');
}

module.exports = { connect, getDatabase, close };