import type { Request, Response, NextFunction } from "express";
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: "Not found" });
}
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Log the full error server-side for debugging
  console.error(err);

  // Extract a useful message — Drizzle/pg errors carry the real reason in
  // .message (e.g. constraint violations, missing columns, type mismatches).
  let message = "Internal server error";
  if (err instanceof Error) {
    // Include the cause chain when present (Node 16+ Error.cause)
    const cause = (err as Error & { cause?: unknown }).cause;
    message = cause instanceof Error
      ? `${err.message}: ${cause.message}`
      : err.message;
  }

  res.status(500).json({ success: false, error: message });
}
