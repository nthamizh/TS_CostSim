/// <reference types="node" />
/**
 * Scheduler ETL webhook receiver.
 *
 * Platform POSTs here when a scheduled ETL job fires.
 * Payload: { runId, jobType: "etl", jobConfig: { targetTable, sourceFileId, enterpriseId? } }
 *
 * Source file is a CSV uploaded to Platform's own file storage.
 * The ETL fetches it via Platform's authenticated file API, parses
 * the CSV into row objects, then does a full replace for the target
 * enterprise+table in a single transaction.
 *
 * enterpriseId resolution order:
 *   1. jobConfig.enterpriseId (explicit - for platform-admin jobs targeting a specific enterprise)
 *   2. The enterpriseId claim in the Platform service token (the caller's enterprise context)
 * If neither is present, the job fails with a clear error.
 */
import { Router, type IRouter } from "express";
import { asyncHandler }         from "../../middleware/asyncHandler.js";
import { etlWebhookSchema }     from "@costsim/validation";
import { db }                   from "../../db/client.js";
import { env }                  from "../../config/env.js";
import * as T                   from "../../db/schema.js";
import { eq }                   from "drizzle-orm";
import jwt                      from "jsonwebtoken";
import type { CostSimServiceToken } from "@costsim/types";

export const etlRouter: IRouter = Router();

// -- Auth helpers -------------------------------------------------------------

/** Verify and decode Platform's scheduler webhook JWT.
 *  Tries PLATFORM_WEBHOOK_SECRET first (the dedicated scheduler secret),
 *  then falls back to COSTSIM_SHARED_SECRET. This handles two setups:
 *  1. Dedicated: SCHEDULER_WEBHOOK_SECRET set in platform-base =
 *     PLATFORM_WEBHOOK_SECRET set in costsim (recommended)
 *  2. Simple: SCHEDULER_WEBHOOK_SECRET not set in platform-base, so
 *     platform uses CONFIGIQ_SHARED_SECRET to sign - and costsim uses
 *     COSTSIM_SHARED_SECRET which must match CONFIGIQ_SHARED_SECRET. */
function decodeWebhookToken(req: any): (CostSimServiceToken & { runId?: string }) | null {
  const authHeader = req.headers["authorization"] as string | undefined;
  const tokenFromAuth = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const tokenFromHeader = req.headers["x-costsim-token"] as string | undefined;
  const token = tokenFromAuth ?? tokenFromHeader ?? null;

  console.log("[ETL auth] token present:", !!token, "| auth header:", authHeader?.slice(0, 20));

  if (!token) {
    console.error("[ETL auth] no token found in request");
    return null;
  }

  const secrets = [env.PLATFORM_WEBHOOK_SECRET, env.COSTSIM_SHARED_SECRET].filter(Boolean) as string[];
  console.log("[ETL auth] trying", secrets.length, "secrets");

  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret);
      console.log("[ETL auth] verify SUCCESS with secret ending", secret.slice(-4), "| payload type:", typeof payload, "| truthy:", !!payload);
      if (!payload || typeof payload !== "object") {
        console.error("[ETL auth] payload is not an object:", payload);
        continue;
      }
      return payload as CostSimServiceToken & { runId?: string };
    } catch (err) {
      console.error("[ETL auth] jwt.verify FAILED with secret ending", secret.slice(-4), ":", (err as Error).message);
    }
  }
  console.error("[ETL auth] all secrets exhausted");
  return null;
}

// -- Status callback -----------------------------------------------------------

async function reportStatus(runId: string, status: "success" | "failed", message: string) {
  try {
    const callbackToken = jwt.sign(
      { sub: "costsim-etl-worker", runId },
      env.COSTSIM_SHARED_SECRET,
      { expiresIn: "60s" },
    );
    await fetch(`${env.PLATFORM_API_URL}/v1/scheduler/runs/${runId}`, {
      method: "PATCH",
      headers: {
        "Content-Type":    "application/json",
        "Authorization":   `Bearer ${callbackToken}`,
        "X-CostSim-Token": callbackToken,
      },
      body: JSON.stringify({ status, resultMessage: message }),
    });
  } catch (e) {
    console.error("Failed to report ETL status:", e);
  }
}

// -- CSV parser ----------------------------------------------------------------

/**
 * Parses a CSV string into an array of row objects.
 *
 * Handles:
 *  - CRLF and LF line endings
 *  - Quoted fields (fields containing commas or newlines)
 *  - Empty/null values: empty cells and the literal string "null" both
 *    become JavaScript null so the DB receives null rather than the
 *    empty string "null" written into a text column.
 *  - Trailing whitespace stripped from all values.
 */
function parseCsv(text: string): Record<string, string | null>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Strip BOM if present (common when files are saved from Excel)
  const raw = lines[0]!.replace(/^\uFEFF/, "");
  const headers = raw.split(",").map(h => h.trim());

  const rows: Record<string, string | null>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue; // skip blank rows

    // Handle quoted fields properly
    const cells: string[] = [];
    let cursor = 0;
    while (cursor < line.length) {
      if (line[cursor] === '"') {
        // Quoted field - read until closing quote (handling escaped "")
        let val = "";
        cursor++; // skip opening quote
        while (cursor < line.length) {
          if (line[cursor] === '"' && line[cursor + 1] === '"') {
            val += '"'; cursor += 2;
          } else if (line[cursor] === '"') {
            cursor++; break; // closing quote
          } else {
            val += line[cursor++];
          }
        }
        cells.push(val.trim());
        if (line[cursor] === ",") cursor++; // skip comma after closing quote
      } else {
        const end = line.indexOf(",", cursor);
        if (end === -1) {
          cells.push(line.slice(cursor).trim());
          break;
        }
        cells.push(line.slice(cursor, end).trim());
        cursor = end + 1;
      }
    }

    const row: Record<string, string | null> = {};
    headers.forEach((h, idx) => {
      const val = cells[idx] ?? "";
      // Empty string and the literal "null" both map to null
      row[h] = (val === "" || val.toLowerCase() === "null") ? null : val;
    });
    rows.push(row);
  }
  return rows;
}

// -- Table map -----------------------------------------------------------------

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

// -- ETL handler ---------------------------------------------------------------

etlRouter.post("/etl-handler", asyncHandler(async (req, res) => {
  console.log("[ETL] handler entered - body keys:", Object.keys(req.body || {}), "| content-type:", req.headers["content-type"]);
  const tokenPayload = decodeWebhookToken(req);
  console.log("[ETL] tokenPayload:", tokenPayload === null ? "NULL" : typeof tokenPayload, !!tokenPayload);
  if (!tokenPayload) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const parsed = etlWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const { runId, jobConfig } = parsed.data;
  const { targetTable, sourceFileId } = jobConfig;

  // Resolve enterpriseId - explicit in jobConfig wins, else from token
  const enterpriseId = jobConfig.enterpriseId ?? tokenPayload.enterpriseId ?? null;
  if (!enterpriseId) {
    res.status(422).json({ success: false, error: "enterpriseId is required - either in jobConfig or the token must carry an enterprise context." });
    return;
  }

  // Acknowledge immediately - ETL runs async
  res.json({ success: true, data: { accepted: true, runId } });

  // -- Async ETL execution ---------------------------------------------------
  setImmediate(async () => {
    const table = TABLE_MAP[targetTable];
    if (!table) {
      await reportStatus(runId, "failed", `Unknown target table: "${targetTable}". Valid values: ${Object.keys(TABLE_MAP).join(", ")}`);
      return;
    }

    try {
      // Fetch the source CSV from Platform's authenticated file storage API.
      // The token doubles as the auth credential - Platform's service-file
      // endpoint (GET /v1/scheduler/files/:id) verifies it and returns the
      // file bytes as base64.
      const callbackToken = jwt.sign(
        { sub: "costsim-etl-worker", runId },
        env.COSTSIM_SHARED_SECRET,
        { expiresIn: "120s" },
      );

      const fileRes = await fetch(`${env.PLATFORM_API_URL}/v1/scheduler/files/${sourceFileId}`, {
        headers: {
          Authorization:    `Bearer ${callbackToken}`,
          "X-CostSim-Token": callbackToken,
        },
      });

      if (!fileRes.ok) {
        await reportStatus(runId, "failed",
          `Could not fetch source file (id: ${sourceFileId}) from Platform - HTTP ${fileRes.status}. ` +
          `Check the file ID is correct and belongs to the job's creator.`
        );
        return;
      }

      const fileBody = await fileRes.json() as { data?: { fileName: string; contentBase64: string } };
      if (!fileBody.data?.contentBase64) {
        await reportStatus(runId, "failed", "Platform returned an empty file response.");
        return;
      }

      const { fileName, contentBase64 } = fileBody.data;
      const csvText = Buffer.from(contentBase64, "base64").toString("utf8");
      const rows = parseCsv(csvText);

      if (rows.length === 0) {
        await reportStatus(runId, "failed",
          `"${fileName}" parsed to zero data rows. ` +
          `The file must have a header row plus at least one data row, ` +
          `and must be a valid CSV (comma-separated, UTF-8 or UTF-8 BOM).`
        );
        return;
      }

      // Full replace in a transaction - delete old rows then insert new ones.
      // If the insert fails, the delete is rolled back so old data is preserved.
      await db.transaction(async (tx) => {
        await tx.delete(table).where(eq(table.enterpriseId, enterpriseId));
        if (rows.length > 0) {
          const enriched = rows.map(r => ({ ...r, enterpriseId }));
          for (let i = 0; i < enriched.length; i += 500) {
            await tx.insert(table).values(enriched.slice(i, i + 500));
          }
        }
      });

      await db.insert(T.etlRuns).values({
        platformRunId: runId,
        enterpriseId,
        targetTable,
        status:     "success",
        rowsLoaded: rows.length,
        finishedAt: new Date(),
      });

      await reportStatus(runId, "success",
        `Loaded ${rows.length} rows from "${fileName}" into ${targetTable} for enterprise ${enterpriseId}.`
      );

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

/** GET /v1/jobs/etl-runs - ETL history for data admins and platform admins */
etlRouter.get("/etl-runs", asyncHandler(async (req, res) => {
  const tokenPayload = decodeWebhookToken(req);
  if (!tokenPayload) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  // Scope to the caller's enterprise unless they're a platform admin
  const scopeEnterpriseId = tokenPayload.isPlatformAdmin
    ? (req.query["enterpriseId"] as string | undefined)
    : (tokenPayload.enterpriseId ?? undefined);

  const rows = await db.select().from(T.etlRuns)
    .where(scopeEnterpriseId ? eq(T.etlRuns.enterpriseId, scopeEnterpriseId) : undefined)
    .limit(200)
    .orderBy(T.etlRuns.startedAt);
  res.json({ success: true, data: rows });
}));
