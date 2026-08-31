/**
 * Scheduler ETL webhook receiver.
 *
 * Platform POSTs here when a scheduled ETL job fires.
 * Payload shape: { jobId, jobType: "etl", jobConfig: { targetTable, enterpriseId }, runId }
 *
 * Strategy: full replace — DELETE existing rows for this enterprise+table,
 * then read from MinIO (the source file Platform uploaded), parse, and bulk INSERT
 * in a single transaction. The source file is a JSON array matching the DB row shape.
 *
 * Status is reported back to Platform via PATCH /v1/scheduler/runs/:runId.
 */
import { Router, type IRouter } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { etlWebhookSchema } from "@costsim/validation";
import { db } from "../../db/client.js";
import { env } from "../../config/env.js";
import * as T from "../../db/schema.js";
import { eq } from "drizzle-orm";
// jsonwebtoken is CommonJS — default import required for ESM runtime compatibility.
// Named imports typecheck (esModuleInterop) but fail at runtime in Node ESM.
import jwt from "jsonwebtoken";

export const etlRouter: IRouter = Router();

/** Verify Platform's scheduler webhook HMAC token (same COSTSIM_SHARED_SECRET). */
function verifyWebhookToken(req: any): boolean {
  const token = req.headers["x-costsim-token"] as string | undefined;
  if (!token) return false;
  try { jwt.verify(token, env.COSTSIM_SHARED_SECRET); return true; }
  catch { return false; }
}

async function reportStatus(runId: string, status: "success" | "failed", message: string) {
  try {
    // Platform's verifyCallbackToken (webhookAuth.ts) checks TWO claims:
    // runId (to cross-check against the URL :id) and sub. A token minted
    // without runId is rejected with 401 regardless of the shared secret —
    // confirmed by reading Platform's own verifyCallbackToken source.
    // The original token minted here lacked runId entirely, which would
    // have left every ETL run stuck in "running" state on Platform forever.
    const callbackToken = jwt.sign(
      { sub: "costsim-etl-worker", runId },
      env.COSTSIM_SHARED_SECRET,
      { expiresIn: "60s" },
    );
    await fetch(`${env.PLATFORM_API_URL}/v1/scheduler/runs/${runId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${callbackToken}`,
        "X-CostSim-Token": callbackToken,
      },
      body: JSON.stringify({ status, resultMessage: message }),
    });
  } catch (e) {
    console.error("Failed to report ETL status:", e);
  }
}

const TABLE_MAP: Record<string, any> = {
  eligibility:        T.eligibilityCosting,
  department:         T.departmentCosting,
  person:             T.personCosting,
  person_element:     T.personElementCosting,
  position:           T.positionCosting,
  job:                T.jobCosting,
  payroll:            T.payrollCosting,
  fast_formula:       T.fastFormulaOverride,
  iac_ppg:            T.iacPpgOverride,
  iac_seg:            T.iacSegOverride,
  valid_combinations: T.validCombinations,
  list_of_values:     T.listOfValues,
};

etlRouter.post("/etl-handler", asyncHandler(async (req, res) => {
  if (!verifyWebhookToken(req)) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const parsed = etlWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const { runId, jobConfig } = parsed.data;
  const { targetTable, enterpriseId } = jobConfig;

  // Acknowledge immediately — ETL runs async
  res.json({ success: true, data: { accepted: true, runId } });

  // ── Async ETL execution ─────────────────────────────────────────────────
  setImmediate(async () => {
    const table = TABLE_MAP[targetTable];
    if (!table) {
      await reportStatus(runId, "failed", `Unknown target table: ${targetTable}`);
      return;
    }

    try {
      // The source data arrives as a JSON array in the job's own MinIO object
      // (key: costsim/etl/<enterpriseId>/<targetTable>.json). The enterprise
      // admin uploads the file via the CostSimulator web UI before scheduling.
      const { Client } = await import("minio");
      const minio = new Client({
        endPoint:  env.STORAGE_ENDPOINT,
        port:      env.STORAGE_PORT,
        useSSL:    env.STORAGE_USE_SSL,
        accessKey: env.STORAGE_ACCESS_KEY,
        secretKey: env.STORAGE_SECRET_KEY,
      });

      const objectKey = `etl/${enterpriseId}/${targetTable}.json`;
      const stream = await minio.getObject(env.STORAGE_BUCKET, objectKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const rows: Record<string, unknown>[] = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      // Full replace in a transaction
      await db.transaction(async tx => {
        const entCol = table.enterpriseId;
        await tx.delete(table).where(eq(entCol, enterpriseId));
        if (rows.length > 0) {
          const enriched = rows.map(r => ({ ...r, enterpriseId }));
          // Insert in batches of 500
          for (let i = 0; i < enriched.length; i += 500) {
            await tx.insert(table).values(enriched.slice(i, i + 500));
          }
        }
      });

      // Log run
      await db.insert(T.etlRuns).values({
        platformRunId: runId,
        enterpriseId,
        targetTable,
        status: "success",
        rowsLoaded: rows.length,
        finishedAt: new Date(),
      });

      await reportStatus(runId, "success", `Loaded ${rows.length} rows into ${targetTable} for enterprise ${enterpriseId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.insert(T.etlRuns).values({
        platformRunId: runId, enterpriseId, targetTable,
        status: "failed", errorMessage: msg, finishedAt: new Date(),
      }).catch(() => {});
      await reportStatus(runId, "failed", msg);
    }
  });
}));

/** GET /v1/jobs/etl-runs — view ETL history (data admins + platform admins) */
etlRouter.get("/etl-runs", asyncHandler(async (req, res) => {
  if (!verifyWebhookToken(req)) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const { enterpriseId } = req.query as { enterpriseId?: string };
  const rows = await db.select().from(T.etlRuns)
    .where(enterpriseId ? eq(T.etlRuns.enterpriseId, enterpriseId) : undefined)
    .limit(200)
    .orderBy(T.etlRuns.startedAt);
  res.json({ success: true, data: rows });
}));
