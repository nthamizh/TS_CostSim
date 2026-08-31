import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
// pg is CommonJS — default import for ESM runtime compatibility
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new pg.Client({ connectionString: process.env["DATABASE_URL"]! });

await client.connect();
console.log("🗄️  Running CostSimulator migrations…");

const migrationsDir = join(__dirname, "migrations");
const files = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log(`  → ${file}`);
  await client.query(sql).catch(e => {
    if (!e.message.includes("already exists")) throw e;
  });
}

await client.end();
console.log("✅  Migrations complete");
