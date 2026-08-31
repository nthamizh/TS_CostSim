import type { Request, Response, NextFunction } from "express";
// jsonwebtoken is CommonJS — use named imports under NodeNext moduleResolution
import { verify } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { CostSimServiceToken } from "@costsim/types";

declare global {
  namespace Express {
    interface Request {
      serviceToken: CostSimServiceToken;
    }
  }
}

/**
 * Verifies the X-CostSim-Token header signed by Platform API.
 */
export async function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-costsim-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ success: false, error: "Missing service token" });
    return;
  }
  try {
    const payload = verify(token, env.COSTSIM_SHARED_SECRET) as CostSimServiceToken;
    req.serviceToken = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired service token" });
  }
}

export function requirePermission(key: keyof CostSimServiceToken["permissions"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const t = req.serviceToken;
    if (!t) { res.status(401).json({ success: false, error: "Missing service token" }); return; }
    if (t.isPlatformAdmin || t.permissions[key]) { next(); return; }
    res.status(403).json({ success: false, error: "Insufficient permissions" });
  };
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.serviceToken?.isPlatformAdmin) {
    res.status(403).json({ success: false, error: "Platform admin required" });
    return;
  }
  next();
}
