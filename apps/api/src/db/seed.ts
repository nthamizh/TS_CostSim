// Seed is a no-op for CostSimulator — all data arrives via ETL scheduler jobs.
// This file exists so docker-compose.coolify.yml's seed service runs cleanly.
import "dotenv/config";
console.log("✅  CostSimulator seed: nothing to seed (data arrives via ETL). Done.");
