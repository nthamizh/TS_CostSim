import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV:  z.enum(["development","test","production"]).default("development"),
  PORT:      z.coerce.number().default(4002),

  DATABASE_URL:              z.string().min(1),
  REDIS_URL:                 z.string().default("redis://costsim-redis:6379"),
  COSTSIM_SHARED_SECRET:     z.string().min(32),
  // The secret Platform's scheduler uses to sign all outbound webhook tokens.
  // Must match SCHEDULER_WEBHOOK_SECRET in platform-base (or fall back to
  // CONFIGIQ_SHARED_SECRET if SCHEDULER_WEBHOOK_SECRET is not set there).
  // Simplest setup: set this to the same value as COSTSIM_SHARED_SECRET
  // AND set SCHEDULER_WEBHOOK_SECRET in platform-base to that same value.
  // If unset, falls back to COSTSIM_SHARED_SECRET for backward compat.
  PLATFORM_WEBHOOK_SECRET:   z.string().min(32).optional(),

  // Platform API for scheduler run-status callbacks
  PLATFORM_API_URL:          z.string().url().default("http://api:4000"),

  // MinIO — costsim-owned bucket for ETL source files
  STORAGE_ENDPOINT:          z.string().default("localhost"),
  STORAGE_PORT:              z.coerce.number().default(9000),
  STORAGE_ACCESS_KEY:        z.string().default("minioadmin"),
  STORAGE_SECRET_KEY:        z.string().default("minioadmin"),
  STORAGE_BUCKET:            z.string().default("costsim"),
  // z.coerce.boolean() treats any non-empty string as true — use literal check.
  STORAGE_USE_SSL:           z.string().default("false").transform(v => v === "true"),
  SIGNED_URL_TTL:            z.coerce.number().default(900),

  LOG_LEVEL: z.enum(["fatal","error","warn","info","debug","trace"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ CostSim env error:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}
export const env = parsed.data;
