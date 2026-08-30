// ---------------------------------------------------------------------------
// CostSimulator DB schema
//
// Tenancy: enterpriseId on every data-source table. NULL = common/platform-
// owned reference data. RLS enforced via set_config('app.current_enterprise_id').
//
// No local users table — identity arrives via Platform's signed service token.
// ---------------------------------------------------------------------------
import {
  pgTable, pgEnum, text, timestamp, uuid, integer,
  boolean, uniqueIndex, index, real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Lists of values ───────────────────────────────────────────────────────────
export const listOfValues = pgTable(
  "costsim_lov",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    enterpriseId: uuid("enterprise_id"),
    category:     text("category").notNull(), // "Legal Employer" | "People Group 1" | …
    value:        text("value").notNull(),
    sortOrder:    integer("sort_order").notNull().default(0),
    createdAt:    timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_lov_ent_cat_idx").on(t.enterpriseId, t.category)],
);

// ── Valid combinations ────────────────────────────────────────────────────────
export const validCombinations = pgTable(
  "costsim_valid_combinations",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    enterpriseId: uuid("enterprise_id"),
    legalEmployer: text("legal_employer").notNull(),
    peopleGroup1:  text("people_group1").notNull(),
    peopleGroup2:  text("people_group2").notNull(),
    peopleGroup3:  text("people_group3"),
    createdAt:    timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [
    index("costsim_vc_ent_idx").on(t.enterpriseId),
    uniqueIndex("costsim_vc_combo_idx").on(t.enterpriseId, t.legalEmployer, t.peopleGroup1, t.peopleGroup2, t.peopleGroup3),
  ],
);

// ── Element Eligibility Costing ───────────────────────────────────────────────
export const accountTypeEnum = pgEnum("costsim_account_type", ["Cost Account","Offset Account"]);

export const eligibilityCosting = pgTable(
  "costsim_eligibility",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    enterpriseId:         uuid("enterprise_id"),
    elementName:          text("element_name").notNull(),
    eligibility:          text("eligibility").notNull(),
    accountType:          accountTypeEnum("account_type").notNull(),
    eligibilityStartDate: text("eligibility_start_date").notNull(),
    eligibilityEndDate:   text("eligibility_end_date").notNull(),
    legalEmployer:        text("legal_employer"),
    peopleGroup1:         text("people_group1"),
    peopleGroup2:         text("people_group2"),
    peopleGroup3:         text("people_group3"),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [
    index("costsim_elig_ent_elem_idx").on(t.enterpriseId, t.elementName),
    index("costsim_elig_ent_idx").on(t.enterpriseId),
  ],
);

// ── Costing for Department ────────────────────────────────────────────────────
export const departmentCosting = pgTable(
  "costsim_department",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    enterpriseId: uuid("enterprise_id"),
    deptName:     text("dept_name").notNull(),
    effStartDate: text("eff_start_date").notNull(),
    effEndDate:   text("eff_end_date").notNull(),
    percentage:   real("percentage").notNull().default(100),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_dept_ent_name_idx").on(t.enterpriseId, t.deptName)],
);

// ── Costing for Person ────────────────────────────────────────────────────────
export const personCosting = pgTable(
  "costsim_person",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    enterpriseId:     uuid("enterprise_id"),
    personNumber:     text("person_number").notNull(),
    assignmentNumber: text("assignment_number").notNull(),
    personType:       text("person_type"),
    department:       text("department"),
    personAgency:     text("person_agency"),
    legalEntity:      text("legal_entity").notNull(),
    peopleGroup:      text("people_group"),
    percentage:       real("percentage").notNull().default(100),
    parStartDate:     text("par_start_date").notNull(),
    parEndDate:       text("par_end_date").notNull(),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [
    index("costsim_person_ent_asg_idx").on(t.enterpriseId, t.assignmentNumber),
    index("costsim_person_ent_idx").on(t.enterpriseId),
  ],
);

// ── Costing for Person – Element ──────────────────────────────────────────────
export const personElementCosting = pgTable(
  "costsim_person_element",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    enterpriseId:     uuid("enterprise_id"),
    personNumber:     text("person_number").notNull(),
    assignmentNumber: text("assignment_number").notNull(),
    element:          text("element").notNull(),
    personType:       text("person_type"),
    department:       text("department"),
    personAgency:     text("person_agency"),
    legalEntity:      text("legal_entity").notNull(),
    peopleGroup:      text("people_group"),
    percentage:       real("percentage").notNull().default(100),
    parStartDate:     text("par_start_date").notNull(),
    parEndDate:       text("par_end_date").notNull(),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [
    index("costsim_pe_ent_asg_elem_idx").on(t.enterpriseId, t.assignmentNumber, t.element),
    index("costsim_pe_ent_idx").on(t.enterpriseId),
  ],
);

// ── Costing of Position ───────────────────────────────────────────────────────
export const positionCosting = pgTable(
  "costsim_position",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    enterpriseId: uuid("enterprise_id"),
    positionCode: text("position_code").notNull(),
    positionName: text("position_name").notNull(),
    effStartDate: text("eff_start_date").notNull(),
    effEndDate:   text("eff_end_date").notNull(),
    percentage:   real("percentage").notNull().default(100),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_pos_ent_code_idx").on(t.enterpriseId, t.positionCode)],
);

// ── Costing of Job ────────────────────────────────────────────────────────────
export const jobCosting = pgTable(
  "costsim_job",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    enterpriseId: uuid("enterprise_id"),
    jobCode:      text("job_code").notNull(),
    jobName:      text("job_name").notNull(),
    effStartDate: text("eff_start_date").notNull(),
    effEndDate:   text("eff_end_date").notNull(),
    percentage:   real("percentage").notNull().default(100),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_job_ent_code_idx").on(t.enterpriseId, t.jobCode)],
);

// ── Costing of Payroll ────────────────────────────────────────────────────────
export const payrollCosting = pgTable(
  "costsim_payroll",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    enterpriseId:        uuid("enterprise_id"),
    payrollDefinition:   text("payroll_definition").notNull(),
    effStartDate:        text("eff_start_date").notNull(),
    effEndDate:          text("eff_end_date").notNull(),
    percentage:          real("percentage").notNull().default(100),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_payroll_ent_def_idx").on(t.enterpriseId, t.payrollDefinition)],
);

// ── Fast Formula Override ─────────────────────────────────────────────────────
export const fastFormulaOverride = pgTable(
  "costsim_fast_formula",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    enterpriseId:  uuid("enterprise_id"),
    key:           text("key").notNull(),
    element:       text("element").notNull(),
    priorityRank:  integer("priority_rank").notNull(),
    legalEntity:   text("legal_entity"),   // null or ANY = wildcard
    peopleGroup1:  text("people_group1"),
    peopleGroup2:  text("people_group2"),
    personAgency:  text("person_agency"),
    personType:    text("person_type"),
    contractClause: text("contract_clause"),
    startDate:     text("start_date").notNull(),
    endDate:       text("end_date").notNull(),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [
    index("costsim_ff_ent_elem_idx").on(t.enterpriseId, t.element),
    index("costsim_ff_ent_idx").on(t.enterpriseId),
  ],
);

// ── Interagency LE PPG EL Override ───────────────────────────────────────────
export const iacOverrideTypeEnum = pgEnum("costsim_iac_account_type", ["Cost","Offset","Both"]);

export const iacPpgOverride = pgTable(
  "costsim_iac_ppg",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    enterpriseId:         uuid("enterprise_id"),
    legalEntity:          text("legal_entity").notNull(),
    peopleGroupSegment:   text("people_group_segment").notNull(),
    element:              text("element").notNull(),
    accountType:          iacOverrideTypeEnum("account_type").notNull(),
    isActive:             boolean("is_active").notNull().default(true),
    startDate:            text("start_date").notNull(),
    endDate:              text("end_date").notNull(),
    seg1: text("seg1"), seg2: text("seg2"), seg3: text("seg3"),
    seg4: text("seg4"), seg5: text("seg5"), seg6: text("seg6"),
    seg7: text("seg7"), seg8: text("seg8"), seg9: text("seg9"),
    createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_iac_ppg_ent_le_idx").on(t.enterpriseId, t.legalEntity)],
);

// ── Interagency LE Segment Override ──────────────────────────────────────────
export const iacSegOverride = pgTable(
  "costsim_iac_seg",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    enterpriseId: uuid("enterprise_id"),
    legalEntity:  text("legal_entity").notNull(),
    accountType:  iacOverrideTypeEnum("account_type").notNull(),
    segment:      text("segment").notNull(), // "Segment 1" … "Segment 9"
    oldValue:     text("old_value"),
    newValue:     text("new_value"),
    startDate:    text("start_date").notNull(),
    endDate:      text("end_date").notNull(),
    createdAt:    timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  },
  t => [index("costsim_iac_seg_ent_le_idx").on(t.enterpriseId, t.legalEntity)],
);

// ── ETL staging ───────────────────────────────────────────────────────────────
// Records each scheduler-triggered full sync. Data replaces the existing rows
// for that enterprise+table (DELETE WHERE enterpriseId=? then bulk INSERT)
// inside a transaction — safe because a failed job leaves old data intact.
export const etlJobStatusEnum = pgEnum("costsim_etl_status", ["running","success","failed"]);

export const etlRuns = pgTable(
  "costsim_etl_runs",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    platformRunId: text("platform_run_id").notNull(), // Platform job_runs.id
    enterpriseId: uuid("enterprise_id").notNull(),
    targetTable:  text("target_table").notNull(),
    status:       etlJobStatusEnum("status").notNull().default("running"),
    rowsLoaded:   integer("rows_loaded"),
    errorMessage: text("error_message"),
    startedAt:    timestamp("started_at",{withTimezone:true}).notNull().defaultNow(),
    finishedAt:   timestamp("finished_at",{withTimezone:true}),
  },
  t => [
    index("costsim_etl_runs_ent_idx").on(t.enterpriseId),
    index("costsim_etl_runs_run_idx").on(t.platformRunId),
  ],
);
