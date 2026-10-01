-- Migration 0006: Add costingSubType to payroll, department, job, position,
--                 person, person_element and costableType to eligibility.
--
-- costingSubType mirrors / is copied from the existing costingType column.
-- costableType on eligibility holds the Oracle costing type code (always EL).
-- Run BEFORE redeploying the API.

-- ── Costing of Payroll ──────────────────────────────────────────────────────
ALTER TABLE costsim_payroll
  ADD COLUMN IF NOT EXISTS costing_sub_type TEXT;
-- Back-fill: copy existing costing_type value; default to COST when null
UPDATE costsim_payroll
  SET costing_sub_type = COALESCE(costing_type, 'COST')
  WHERE costing_sub_type IS NULL;

-- ── Costing for Department ──────────────────────────────────────────────────
ALTER TABLE costsim_department
  ADD COLUMN IF NOT EXISTS costing_sub_type TEXT;
UPDATE costsim_department
  SET costing_sub_type = COALESCE(costing_type, 'COST')
  WHERE costing_sub_type IS NULL;

-- ── Costing of Job ──────────────────────────────────────────────────────────
ALTER TABLE costsim_job
  ADD COLUMN IF NOT EXISTS costing_type      TEXT,
  ADD COLUMN IF NOT EXISTS costing_sub_type  TEXT;
UPDATE costsim_job
  SET costing_sub_type = 'COST'
  WHERE costing_sub_type IS NULL;

-- ── Costing of Position ─────────────────────────────────────────────────────
ALTER TABLE costsim_position
  ADD COLUMN IF NOT EXISTS costing_type      TEXT,
  ADD COLUMN IF NOT EXISTS costing_sub_type  TEXT;
UPDATE costsim_position
  SET costing_sub_type = 'COST'
  WHERE costing_sub_type IS NULL;

-- ── Costing for Person ──────────────────────────────────────────────────────
ALTER TABLE costsim_person
  ADD COLUMN IF NOT EXISTS costing_sub_type TEXT;
UPDATE costsim_person
  SET costing_sub_type = COALESCE(costing_type, 'COST')
  WHERE costing_sub_type IS NULL;

-- ── Costing for Person Element ──────────────────────────────────────────────
ALTER TABLE costsim_person_element
  ADD COLUMN IF NOT EXISTS costing_sub_type TEXT;
UPDATE costsim_person_element
  SET costing_sub_type = COALESCE(costing_type, 'COST')
  WHERE costing_sub_type IS NULL;

-- ── Element Eligibility Costing ─────────────────────────────────────────────
-- costableType is the Oracle costing type code — fixed value EL for eligibility.
ALTER TABLE costsim_eligibility
  ADD COLUMN IF NOT EXISTS costable_type TEXT;
-- Back-fill from existing costing_type value; EL is the correct default
UPDATE costsim_eligibility
  SET costable_type = 'EL'
  WHERE costable_type IS NULL;
