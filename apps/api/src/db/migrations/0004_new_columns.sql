-- Migration 0004: Add LDG, costing type, sub-type sequence columns
-- and remove default segment columns from the UI (kept in DB).

-- Costing of Payroll
ALTER TABLE costsim_payroll
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS costing_type      TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT;

-- Costing for Department
ALTER TABLE costsim_department
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS costing_type      TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT;

-- Costing for Person
ALTER TABLE costsim_person
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS costing_type      TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT;

-- Costing for Person Element
ALTER TABLE costsim_person_element
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS costing_type      TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT;

-- Costing of Position
ALTER TABLE costsim_position
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT;

-- Costing of Job
ALTER TABLE costsim_job
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT;
