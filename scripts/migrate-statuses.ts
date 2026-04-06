// scripts/migrate-statuses.ts
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;

async function run() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(); // uses DB from URI
    const collection = db.collection("yourCollectionName");

    // DONE -> COMPLETED
    const doneResult = await collection.updateMany(
      { status: "DONE" },
      { $set: { status: "COMPLETED" } }
    );

    // NO_DOC -> MISSING_DOCUMENT
    const noDocResult = await collection.updateMany(
      { status: "NO_DOC" },
      { $set: { status: "MISSING_DOCUMENT" } }
    );

    console.log("DONE updated:", doneResult.modifiedCount);
    console.log("NO_DOC updated:", noDocResult.modifiedCount);
  } finally {
    await client.close();
  }
}

run().catch(console.error);