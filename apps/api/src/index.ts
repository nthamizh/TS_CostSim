import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { env } from "./config/env.js";
import { requireServiceToken } from "./middleware/auth.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { costingRouter } from "./modules/costing/costing.routes.js";
import { etlRouter } from "./modules/etl/etl.routes.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
// Internal only — CORS locked to false; only Platform API calls this service
app.use(cors({ origin: false }));
app.use(express.json({ limit: "10mb" }));

// Public
app.use("/health", healthRouter);

// All costing endpoints require Platform's service token
app.use("/v1/costing", costingRouter);
// ETL webhook (token verified inside the handler — same secret, scheduler pattern)
app.use("/v1/jobs", etlRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 CostSimulator API running on port ${env.PORT}`);
});
