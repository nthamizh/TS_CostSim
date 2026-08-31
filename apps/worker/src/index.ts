// ioredis is a CommonJS package. With moduleResolution: NodeNext, TypeScript
// is strict about CJS default imports — "import Redis from 'ioredis'" fails
// with TS2351 (not constructable). Named import is the correct form and works
// under both moduleResolution modes.
import { Redis } from "ioredis";

// ---------------------------------------------------------------------------
// CostSimulator worker — dormant job consumer.
// Kept alive as infrastructure for future async workloads:
//   - Bulk what-if simulation (thousands of assignments at once)
//   - Large ETL post-processing / validation
//   - Async report generation
//
// No handlers registered yet — add to JOB_HANDLERS when a real async
// need arises. Everything ETL today is handled synchronously in the
// etl.routes.ts webhook receiver.
// ---------------------------------------------------------------------------

const REDIS_URL  = process.env["REDIS_URL"] ?? "redis://costsim-redis:6379";
const QUEUE_NAME = "costsim:jobs";
const WORKER_ID  = `worker-${Math.random().toString(36).slice(2, 10)}`;

interface JobPayload { type: string; [key: string]: unknown; }
type JobHandler = (payload: JobPayload) => Promise<void>;

// Add handlers here: JOB_HANDLERS["bulk_simulate"] = async (payload) => {...}
const JOB_HANDLERS: Record<string, JobHandler> = {};

async function main() {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  console.log(`⚙️  [${WORKER_ID}] CostSim worker started, listening on "${QUEUE_NAME}" (no handlers registered)`);

  for (;;) {
    const result = await redis.brpop(QUEUE_NAME, 5);
    if (!result) continue;
    const [, raw] = result;
    let payload: JobPayload;
    try { payload = JSON.parse(raw) as JobPayload; }
    catch { console.error(`[${WORKER_ID}] Malformed payload: ${raw}`); continue; }
    const handler = JOB_HANDLERS[payload.type];
    if (!handler) { console.warn(`[${WORKER_ID}] No handler for "${payload.type}" — discarding`); continue; }
    try { await handler(payload); }
    catch (err) { console.error(`[${WORKER_ID}] Job "${payload.type}" failed:`, err); }
  }
}

main().catch(err => { console.error("Worker crashed:", err); process.exit(1); });
