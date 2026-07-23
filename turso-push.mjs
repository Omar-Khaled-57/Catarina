import { createClient } from "@libsql/client";
import fs from "fs";

async function pushSchema() {
  console.log("Connecting to Turso...");
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const sql = fs.readFileSync("migrate.sql", "utf-8");
  
  // Turso client supports executing multiple statements by splitting them
  // executeMultiple or we can just run transaction.
  try {
    console.log("Executing SQL schema...");
    await client.executeMultiple(sql);
    console.log("Schema successfully pushed to Turso!");
  } catch (err) {
    console.error("Failed to push schema:", err);
    process.exit(1);
  }
}

pushSchema();
