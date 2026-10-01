-- Migration 0008
--  A. Repair costing_type / costing_sub_type left by 0006 (which copied costing_type
--     into costing_sub_type verbatim, so values like 'ASG' or 'Costed' ended up as
--     sub-types, and payroll/department kept COST/SUSP/DFLT in costing_type).
--  B. Move enterprise config from the 9-rank model to the 16-level model.
-- Safe to re-run: every statement is conditional.

-- ── A. Repair ────────────────────────────────────────────────────────────────
-- Sub-type first (reads the old costing_type), then pin the fixed Oracle type code.
UPDATE costsim_payroll SET costing_sub_type = CASE
    WHEN costing_sub_type IN ('COST','SUSP','DFLT') THEN costing_sub_type
    WHEN costing_type     IN ('COST','SUSP','DFLT') THEN costing_type
    ELSE 'COST' END;
UPDATE costsim_payroll SET costing_type = 'PAY' WHERE costing_type IS DISTINCT FROM 'PAY';

UPDATE costsim_department SET costing_sub_type = CASE
    WHEN costing_sub_type IN ('COST','SUSP','DFLT') THEN costing_sub_type
    WHEN costing_type     IN ('COST','SUSP','DFLT') THEN costing_type
    ELSE 'COST' END;
UPDATE costsim_department SET costing_type = 'ORG' WHERE costing_type IS DISTINCT FROM 'ORG';

UPDATE costsim_job      SET costing_sub_type = 'COST' WHERE costing_sub_type IS DISTINCT FROM 'COST';
UPDATE costsim_job      SET costing_type     = 'JOB'  WHERE costing_type     IS DISTINCT FROM 'JOB';
UPDATE costsim_position SET costing_sub_type = 'COST' WHERE costing_sub_type IS DISTINCT FROM 'COST';
UPDATE costsim_position SET costing_type     = 'POS'  WHERE costing_type     IS DISTINCT FROM 'POS';

UPDATE costsim_person         SET costing_sub_type = 'COST' WHERE costing_sub_type IS DISTINCT FROM 'COST';
UPDATE costsim_person_element SET costing_sub_type = 'COST' WHERE costing_sub_type IS DISTINCT FROM 'COST';

-- ── B. 9-rank -> 16-level config ─────────────────────────────────────────────
-- hierarchy_version 1 = legacy 9-rank numbering, 2 = 16-level numbering.
-- Old rank -> new level(s):
--   1 fast formula->11   2 element entry->10   3 person-element->8,9   4 person->6,7
--   5 position->5        6 job->4              7 department->3         8 eligibility->2
--   9 payroll->1.   Levels 12-16 are new and are switched on.
ALTER TABLE costsim_enterprise_config
  ADD COLUMN IF NOT EXISTS hierarchy_version INT NOT NULL DEFAULT 1;

UPDATE costsim_enterprise_config SET
  active_ranks = (
    SELECT COALESCE(jsonb_agg(DISTINCT n ORDER BY n), '[]'::jsonb)::text FROM (
      SELECT unnest(CASE o::int
               WHEN 1 THEN ARRAY[11] WHEN 2 THEN ARRAY[10] WHEN 3 THEN ARRAY[8,9]
               WHEN 4 THEN ARRAY[6,7] WHEN 5 THEN ARRAY[5]  WHEN 6 THEN ARRAY[4]
               WHEN 7 THEN ARRAY[3]   WHEN 8 THEN ARRAY[2]  WHEN 9 THEN ARRAY[1]
               ELSE ARRAY[]::int[] END) AS n
      FROM jsonb_array_elements_text(active_ranks::jsonb) AS o
      UNION SELECT unnest(ARRAY[12,13,14,15,16])
    ) s),
  rank_seg_masks = (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('rank', n, 'excludedSegs', m->'excludedSegs')), '[]'::jsonb)::text
    FROM jsonb_array_elements(rank_seg_masks::jsonb) AS m
    CROSS JOIN LATERAL unnest(CASE (m->>'rank')::int
               WHEN 1 THEN ARRAY[11] WHEN 2 THEN ARRAY[10] WHEN 3 THEN ARRAY[8,9]
               WHEN 4 THEN ARRAY[6,7] WHEN 5 THEN ARRAY[5]  WHEN 6 THEN ARRAY[4]
               WHEN 7 THEN ARRAY[3]   WHEN 8 THEN ARRAY[2]  WHEN 9 THEN ARRAY[1]
               ELSE ARRAY[]::int[] END) AS n),
  hierarchy_version = 2
WHERE hierarchy_version = 1;

ALTER TABLE costsim_enterprise_config ALTER COLUMN hierarchy_version SET DEFAULT 2;
ALTER TABLE costsim_enterprise_config ALTER COLUMN active_ranks
  SET DEFAULT '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]';
