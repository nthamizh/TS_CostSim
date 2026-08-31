import { Router, type IRouter } from "express";
export const healthRouter: IRouter = Router();
healthRouter.get("/", (_req, res) => res.json({ status: "ok", uptime: process.uptime(), service: "costsim-api" }));
