import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is missing in .env");
  process.exit(1);
}

// একটাই MongoClient সার্ভারজুড়ে reuse হবে
const client = new MongoClient(uri);

let db;

export async function connectDB() {
  if (db) return db;
  try {
    await client.connect();
    db = client.db("booknook");
    console.log("MongoDB connected -> database: booknook");
    return db;
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Database not connected yet");
  }
  return db;
}

export const getBooksCollection = () => getDB().collection("books");
export const getBorrowsCollection = () => getDB().collection("borrows");
