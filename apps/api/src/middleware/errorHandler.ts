import type { Request, Response, NextFunction } from "express";
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: "Not found" });
}
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
}
