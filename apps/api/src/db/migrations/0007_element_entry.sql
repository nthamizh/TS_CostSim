-- Migration 0007: Element Entry Costing table
-- Mirrors costsim_person_element but for Oracle level EE COST.
-- costingType = EE, costingSubType = COST, percentage always 100.
-- No personNumber column — element entry is keyed by assignment + element.

CREATE TABLE IF NOT EXISTS costsim_element_entry (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id     UUID,
  ldg               TEXT,
  assignment_number TEXT        NOT NULL,
  element           TEXT        NOT NULL,
  person_type       TEXT,
  department        TEXT,
  person_agency     TEXT,
  legal_entity      TEXT        NOT NULL,
  people_group      TEXT,
  costing_type      TEXT,
  costing_sub_type  TEXT,
  sub_type_sequence TEXT,
  percentage        REAL        NOT NULL DEFAULT 100,
  par_start_date    TEXT        NOT NULL,
  par_end_date      TEXT        NOT NULL,
  seg1 TEXT, seg2 TEXT, seg3 TEXT,
  seg4 TEXT, seg5 TEXT, seg6 TEXT,
  seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT
);

CREATE INDEX IF NOT EXISTS costsim_ee_ent_asg_elem_idx
  ON costsim_element_entry (enterprise_id, assignment_number, element);

CREATE INDEX IF NOT EXISTS costsim_ee_ent_idx
  ON costsim_element_entry (enterprise_id);
