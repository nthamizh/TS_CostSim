/**
 * Enterprise configuration endpoints.
 * GET  /v1/costing/config          - read config for the caller's enterprise
 * PUT  /v1/costing/config          - upsert (platform admin or enterprise admin)
 * GET  /v1/costing/config/:entId   - platform admin reads any enterprise's config
 */
import { Router, type IRouter } from "express";
import { asyncHandler }         from "../../middleware/asyncHandler.js";
import { requireServiceToken }  from "../../middleware/auth.js";
import { db }                   from "../../db/client.js";
import { enterpriseConfig }     from "../../db/schema.js";
import { eq }                   from "drizzle-orm";
import { z }                    from "zod";

export const configRouter: IRouter = Router();
configRouter.use(requireServiceToken);

// ── Default config ────────────────────────────────────────────────────────────

const DEFAULT_SEGMENT_NAMES = [
  "Segment 1","Segment 2","Segment 3","Segment 4","Segment 5",
  "Segment 6","Segment 7","Segment 8","Segment 9",
];
const DEFAULT_ACTIVE_RANKS  = [1,2,3,4,5,6,7,8,9];

function parseConfig(row: typeof enterpriseConfig.$inferSelect | undefined) {
  if (!row) {
    return {
      segmentNames:   DEFAULT_SEGMENT_NAMES,
      leSegmentNames: {} as Record<string, string[]>,
      activeRanks:    DEFAULT_ACTIVE_RANKS,
    };
  }
  return {
    segmentNames:   JSON.parse(row.segmentNames)   as string[],
    leSegmentNames: JSON.parse(row.leSegmentNames) as Record<string, string[]>,
    activeRanks:    JSON.parse(row.activeRanks)    as number[],
  };
}

// ── Validation schema ─────────────────────────────────────────────────────────

const configBodySchema = z.object({
  segmentNames: z.array(z.string().min(1).max(60)).length(9),
  leSegmentNames: z.record(
    z.string(),                             // LE name
    z.array(z.string().min(1).max(60)).length(9) // 9 segment names for that LE
  ),
  activeRanks: z.array(z.number().int().min(1).max(9)).min(1).max(9),
});

// ── GET /v1/costing/config ────────────────────────────────────────────────────

configRouter.get("/config", asyncHandler(async (req, res) => {
  const eid = req.serviceToken.enterpriseId;
  if (!eid && !req.serviceToken.isPlatformAdmin) {
    res.status(422).json({ success: false, error: "No enterprise context" });
    return;
  }
  const row = eid
    ? await db.query.enterpriseConfig.findFirst({ where: eq(enterpriseConfig.enterpriseId, eid) })
    : undefined;
  res.json({ success: true, data: parseConfig(row) });
}));

// ── GET /v1/costing/config/:enterpriseId  (platform admin only) ───────────────

configRouter.get("/config/:enterpriseId", asyncHandler(async (req, res) => {
  if (!req.serviceToken.isPlatformAdmin) {
    res.status(403).json({ success: false, error: "Platform admin only" });
    return;
  }
  const row = await db.query.enterpriseConfig.findFirst({
    where: eq(enterpriseConfig.enterpriseId, req.params.enterpriseId!),
  });
  res.json({ success: true, data: parseConfig(row) });
}));

// ── PUT /v1/costing/config ────────────────────────────────────────────────────

configRouter.put("/config", asyncHandler(async (req, res) => {
  const token = req.serviceToken;

  // Only platform admin or enterprise admin can save
  const isAdmin = token.isPlatformAdmin ||
    token.permissions?.manageData === true;
  if (!isAdmin) {
    res.status(403).json({ success: false, error: "Enterprise admin or platform admin required" });
    return;
  }

  // Platform admin may pass an explicit enterpriseId in the body
  const targetEid: string | null =
    token.isPlatformAdmin && req.body?.enterpriseId
      ? (req.body.enterpriseId as string)
      : (token.enterpriseId ?? null);

  if (!targetEid) {
    res.status(422).json({ success: false, error: "No target enterprise — platform admins must include enterpriseId in the request body" });
    return;
  }

  const parsed = configBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const { segmentNames, leSegmentNames, activeRanks } = parsed.data;

  await db.insert(enterpriseConfig)
    .values({
      enterpriseId:   targetEid,
      segmentNames:   JSON.stringify(segmentNames),
      leSegmentNames: JSON.stringify(leSegmentNames),
      activeRanks:    JSON.stringify(activeRanks),
      updatedAt:      new Date(),
      updatedBy:      token.sub ?? undefined,
    })
    .onConflictDoUpdate({
      target: enterpriseConfig.enterpriseId,
      set: {
        segmentNames:   JSON.stringify(segmentNames),
        leSegmentNames: JSON.stringify(leSegmentNames),
        activeRanks:    JSON.stringify(activeRanks),
        updatedAt:      new Date(),
        updatedBy:      token.sub ?? undefined,
      },
    });

  res.json({ success: true, data: { segmentNames, leSegmentNames, activeRanks } });
}));
