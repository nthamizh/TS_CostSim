import { drizzle } from "drizzle-orm/node-postgres";
// pg is CommonJS and exports a PG instance (module.exports = new PG(Client)),
// not named exports. Named imports typecheck but fail at Node ESM runtime.
// Use the default import and access Pool/Client as properties.
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
// Raw SQL helper for set_config RLS calls
export const sql = pool.query.bind(pool) as typeof pool.query;
