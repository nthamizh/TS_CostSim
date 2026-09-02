-- CostSimulator enterprise configuration table
-- Stores per-enterprise segment names, per-LE segment names (interagency),
-- and which costing hierarchy ranks are active.

CREATE TABLE IF NOT EXISTS "costsim_enterprise_config" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "enterprise_id"    UUID NOT NULL UNIQUE,
  "segment_names"    TEXT NOT NULL DEFAULT '["Segment 1","Segment 2","Segment 3","Segment 4","Segment 5","Segment 6","Segment 7","Segment 8","Segment 9"]',
  "le_segment_names" TEXT NOT NULL DEFAULT '{}',
  "active_ranks"     TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7,8,9]',
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_by"       UUID
);

CREATE INDEX IF NOT EXISTS "costsim_config_ent_idx"
  ON "costsim_enterprise_config"("enterprise_id");
