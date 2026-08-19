import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

if (!uri) {
  throw new Error("Please add your Mongo URI to environment variables");
}

let client = new MongoClient(uri, options);
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = client.connect().then(async (c) => {
      // Ensure indexes in background
      try {
        const db = c.db("mydatabase");
        await Promise.all([
          db.collection("forwarded_calls").createIndex({ techId: 1, createdAt: -1 }, { background: true }),
          db.collection("forwarded_calls").createIndex({ status: 1, closedAt: -1 }, { background: true }),
          db.collection("fcm_tokens").createIndex({ userId: 1 }, { background: true }),
          db.collection("fcm_tokens").createIndex({ token: 1 }, { background: true }),
          db.collection("service_forms").createIndex({ techId: 1, createdAt: -1 }, { background: true }),
          db.collection("payments").createIndex({ techId: 1, createdAt: -1 }, { background: true }),
        ]);
        console.log("⚡ MongoDB indexes verified");
      } catch (e) {
        console.warn("Index creation warning:", e.message);
      }
      return c;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = client.connect();
}

export default clientPromise;
