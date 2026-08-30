-- CostSimulator initial schema
-- Run via: node dist/db/migrate.js

CREATE TYPE costsim_account_type  AS ENUM ('Cost Account','Offset Account');
CREATE TYPE costsim_iac_account_type AS ENUM ('Cost','Offset','Both');
CREATE TYPE costsim_etl_status    AS ENUM ('running','success','failed');

-- Lists of values
CREATE TABLE costsim_lov (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID,
  category      TEXT NOT NULL,
  value         TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_lov_ent_cat_idx ON costsim_lov(enterprise_id, category);

-- Valid combinations
CREATE TABLE costsim_valid_combinations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id  UUID,
  legal_employer TEXT NOT NULL,
  people_group1  TEXT NOT NULL,
  people_group2  TEXT NOT NULL,
  people_group3  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (enterprise_id, legal_employer, people_group1, people_group2, people_group3)
);
CREATE INDEX costsim_vc_ent_idx ON costsim_valid_combinations(enterprise_id);

-- Eligibility costing
CREATE TABLE costsim_eligibility (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id         UUID,
  element_name          TEXT NOT NULL,
  eligibility           TEXT NOT NULL,
  account_type          costsim_account_type NOT NULL,
  eligibility_start_date TEXT NOT NULL,
  eligibility_end_date   TEXT NOT NULL,
  legal_employer        TEXT, people_group1 TEXT, people_group2 TEXT, people_group3 TEXT,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_elig_ent_elem_idx ON costsim_eligibility(enterprise_id, element_name);

-- Department costing
CREATE TABLE costsim_department (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, dept_name TEXT NOT NULL,
  eff_start_date TEXT NOT NULL, eff_end_date TEXT NOT NULL,
  percentage REAL NOT NULL DEFAULT 100,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_dept_ent_name_idx ON costsim_department(enterprise_id, dept_name);

-- Person costing
CREATE TABLE costsim_person (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, person_number TEXT NOT NULL,
  assignment_number TEXT NOT NULL, person_type TEXT,
  department TEXT, person_agency TEXT, legal_entity TEXT NOT NULL,
  people_group TEXT, percentage REAL NOT NULL DEFAULT 100,
  par_start_date TEXT NOT NULL, par_end_date TEXT NOT NULL,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_person_ent_asg_idx ON costsim_person(enterprise_id, assignment_number);

-- Person-element costing
CREATE TABLE costsim_person_element (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, person_number TEXT NOT NULL,
  assignment_number TEXT NOT NULL, element TEXT NOT NULL,
  person_type TEXT, department TEXT, person_agency TEXT,
  legal_entity TEXT NOT NULL, people_group TEXT,
  percentage REAL NOT NULL DEFAULT 100,
  par_start_date TEXT NOT NULL, par_end_date TEXT NOT NULL,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_pe_ent_asg_elem_idx ON costsim_person_element(enterprise_id, assignment_number, element);

-- Position costing
CREATE TABLE costsim_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, position_code TEXT NOT NULL, position_name TEXT NOT NULL,
  eff_start_date TEXT NOT NULL, eff_end_date TEXT NOT NULL,
  percentage REAL NOT NULL DEFAULT 100,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_pos_ent_code_idx ON costsim_position(enterprise_id, position_code);

-- Job costing
CREATE TABLE costsim_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, job_code TEXT NOT NULL, job_name TEXT NOT NULL,
  eff_start_date TEXT NOT NULL, eff_end_date TEXT NOT NULL,
  percentage REAL NOT NULL DEFAULT 100,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_job_ent_code_idx ON costsim_job(enterprise_id, job_code);

-- Payroll costing
CREATE TABLE costsim_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, payroll_definition TEXT NOT NULL,
  eff_start_date TEXT NOT NULL, eff_end_date TEXT NOT NULL,
  percentage REAL NOT NULL DEFAULT 100,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_payroll_ent_def_idx ON costsim_payroll(enterprise_id, payroll_definition);

-- Fast formula override
CREATE TABLE costsim_fast_formula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, key TEXT NOT NULL, element TEXT NOT NULL,
  priority_rank INTEGER NOT NULL,
  legal_entity TEXT, people_group1 TEXT, people_group2 TEXT,
  person_agency TEXT, person_type TEXT, contract_clause TEXT,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_ff_ent_elem_idx ON costsim_fast_formula(enterprise_id, element);

-- IAC PPG override
CREATE TABLE costsim_iac_ppg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, legal_entity TEXT NOT NULL,
  people_group_segment TEXT NOT NULL, element TEXT NOT NULL,
  account_type costsim_iac_account_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  seg1 TEXT, seg2 TEXT, seg3 TEXT, seg4 TEXT, seg5 TEXT,
  seg6 TEXT, seg7 TEXT, seg8 TEXT, seg9 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_iac_ppg_ent_le_idx ON costsim_iac_ppg(enterprise_id, legal_entity);

-- IAC Segment override
CREATE TABLE costsim_iac_seg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID, legal_entity TEXT NOT NULL,
  account_type costsim_iac_account_type NOT NULL,
  segment TEXT NOT NULL, old_value TEXT, new_value TEXT,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX costsim_iac_seg_ent_le_idx ON costsim_iac_seg(enterprise_id, legal_entity);

-- ETL run log
CREATE TABLE costsim_etl_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_run_id TEXT NOT NULL,
  enterprise_id   UUID NOT NULL,
  target_table    TEXT NOT NULL,
  status          costsim_etl_status NOT NULL DEFAULT 'running',
  rows_loaded     INTEGER,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);
CREATE INDEX costsim_etl_runs_ent_idx ON costsim_etl_runs(enterprise_id);
CREATE INDEX costsim_etl_runs_run_idx ON costsim_etl_runs(platform_run_id);
