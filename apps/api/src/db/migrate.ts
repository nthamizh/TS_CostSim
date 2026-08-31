import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
// pg is CommonJS — named import under NodeNext moduleResolution
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: process.env["DATABASE_URL"]! });

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
