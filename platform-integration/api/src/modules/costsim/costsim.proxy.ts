import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { isPlatformAdmin } from "@platform/auth";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { userRoles } from "../../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import jwt from "jsonwebtoken";

export const costsimRouter = Router();
costsimRouter.use(requireAuth);

async function getCostSimPermissions(userId, enterpriseId) {
  const scopeCondition = enterpriseId ? eq(userRoles.enterpriseId, enterpriseId) : isNull(userRoles.enterpriseId);
  const rows = await db.query.userRoles.findMany({
    where: and(eq(userRoles.userId, userId), scopeCondition),
    with: { role: { with: { rolePermissions: { with: { module: true } } } } },
  });
  const perms = { viewSimulate:false, viewInteragency:false, manageData:false };
  for (const ur of rows) {
    for (const rp of ur.role.rolePermissions) {
      if (rp.module?.key !== "cost_simulator") continue;
      const p = rp.permissions;
      if (p["view_simulate"])    perms.viewSimulate    = true;
      if (p["view_interagency"]) perms.viewInteragency = true;
      if (p["manage_data"])      perms.manageData      = true;
    }
  }
  return perms;
}

costsimRouter.use(asyncHandler(async (req, res) => {
  const COSTSIM_API_URL = env.COSTSIM_API_URL;
  if (!COSTSIM_API_URL) { res.status(503).json({ success:false, error:"CostSimulator not configured" }); return; }
  const user = req.user;
  const enterpriseId = req.tenant?.enterpriseId ?? null;
  const permissions = await getCostSimPermissions(user.sub, enterpriseId);
  const token = jwt.sign(
    { sub:user.sub, enterpriseId, enterpriseName:"", permissions, isPlatformAdmin:isPlatformAdmin(user) },
    env.COSTSIM_SHARED_SECRET,
    { expiresIn:"60s" }
  );
  const qs = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
  const url = COSTSIM_API_URL + "/v1" + req.path + qs;
  const upstreamRes = await fetch(url, {
    method: req.method,
    headers: { "Content-Type":"application/json", "X-CostSim-Token":token, "X-Enterprise-Id":req.tenant?.enterpriseId??"" },
    body: req.method!=="GET"&&req.method!=="HEAD" ? JSON.stringify(req.body) : undefined,
  });
  res.status(upstreamRes.status).json(await upstreamRes.json());
}));
