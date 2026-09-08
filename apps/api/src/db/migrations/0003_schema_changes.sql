-- Migration 0003: Schema changes for Synced Data page improvements
-- Run against the costsim database before redeploying.

-- ── 1. Add audit columns to ALL data tables ───────────────────────────────────
-- created_by / updated_at / updated_by (created_at already exists on all tables)

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'costsim_lov', 'costsim_valid_combinations', 'costsim_eligibility',
    'costsim_department', 'costsim_person', 'costsim_person_element',
    'costsim_position', 'costsim_job', 'costsim_payroll',
    'costsim_fast_formula', 'costsim_iac_ppg', 'costsim_iac_seg'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by  TEXT', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by  TEXT', tbl);
  END LOOP;
END $$;

-- ── 2. Element Eligibility Costing: add costing_type ─────────────────────────
CREATE TYPE costsim_costing_type AS ENUM ('Any','Costed','Fixed','Distributed');

ALTER TABLE costsim_eligibility
  ADD COLUMN IF NOT EXISTS costing_type costsim_costing_type;

-- ── 3. Costing of Department: add default COA columns (d_seg1..d_seg9) ───────
ALTER TABLE costsim_department
  ADD COLUMN IF NOT EXISTS d_seg1 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg2 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg3 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg4 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg5 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg6 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg7 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg8 TEXT,
  ADD COLUMN IF NOT EXISTS d_seg9 TEXT;

-- ── 4. Costing of Payroll: drop percentage column ────────────────────────────
-- percentage was not used by the costing engine for payroll.
ALTER TABLE costsim_payroll
  DROP COLUMN IF EXISTS percentage;

-- ── 5. Add rank_seg_masks column to enterprise config ────────────────────────
-- Stores per-rank segment exclusion masks as JSON.
-- Format: [{ "rank": 4, "excludedSegs": [0] }, { "rank": 7, "excludedSegs": [4] }]
-- An empty array means all active ranks contribute all segments (default).
ALTER TABLE costsim_enterprise_config
  ADD COLUMN IF NOT EXISTS rank_seg_masks TEXT NOT NULL DEFAULT '[]';
