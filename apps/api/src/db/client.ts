import { drizzle } from "drizzle-orm/node-postgres";
// pg is a CommonJS package — named import is required under NodeNext
// moduleResolution (same class of issue as ioredis, same fix).
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
// Raw SQL helper for set_config RLS calls
export const sql = pool.query.bind(pool) as typeof pool.query;
