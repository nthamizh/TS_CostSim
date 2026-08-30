// ── Segment names ─────────────────────────────────────────────────────────────
export const SEGMENT_NAMES = [
  "Agency",
  "Operating Unit",
  "Fund",
  "Cost Centre",
  "Account",
  "Project",
  "Donor",
  "Interagency",
  "Future",
] as const;

export type SegmentName = (typeof SEGMENT_NAMES)[number];

export type SegmentValues = [
  string | null, // 1 Agency
  string | null, // 2 Operating Unit
  string | null, // 3 Fund
  string | null, // 4 Cost Centre
  string | null, // 5 Account
  string | null, // 6 Project
  string | null, // 7 Donor
  string | null, // 8 Interagency
  string | null, // 9 Future
];

// ── Costing hierarchy ranks ────────────────────────────────────────────────────
export type CostingRank =
  | "fast_formula"
  | "element_entry"
  | "person_element"
  | "person_assignment"
  | "position"
  | "job"
  | "department"
  | "element_eligibility"
  | "payroll";

export interface ResolvedSegment {
  value: string | null;
  fromRank: CostingRank | null;
  sourceId: string | null;
}

// ── Simulation ────────────────────────────────────────────────────────────────
export interface SimulationInput {
  elementName: string;
  assignmentNumber: string | null;
  legalEntity: string;
  department: string;
  agency: string;
  peopleGroup1: string;
  peopleGroup2: string;
  peopleGroup3: string | null;
  contractClause: string | null;
  payrollDefinition: string | null;
  jobCode: string | null;
  positionCode: string | null;
  effectiveDate: string; // ISO date
}

export interface HierarchyLevel {
  rank: number;
  name: string;
  sub: string;
  sourceId: string | null;
  segments: SegmentValues;
  editable?: boolean;
  cls?: string;
}

export interface JournalLine {
  type: "Cost" | "Offset";
  segments: SegmentValues;
  levels: HierarchyLevel[];
}

export interface SimulationResult {
  eligible: boolean;
  eligibilityRecord: string | null;
  cost: JournalLine | null;
  offset: JournalLine | null;
  traceMessages: string[];
}

// ── Data source row shapes ────────────────────────────────────────────────────
export interface EligibilityRow {
  id: string;
  enterpriseId: string | null;
  elementName: string;
  eligibility: string;
  accountType: "Cost Account" | "Offset Account";
  eligibilityStartDate: string;
  eligibilityEndDate: string;
  legalEmployer: string | null;
  peopleGroup1: string | null;
  peopleGroup2: string | null;
  peopleGroup3: string | null;
  segments: SegmentValues;
}

export interface DepartmentRow {
  id: string;
  enterpriseId: string | null;
  deptName: string;
  effStartDate: string;
  effEndDate: string;
  segments: SegmentValues;
}

export interface PersonRow {
  id: string;
  enterpriseId: string | null;
  personNumber: string;
  assignmentNumber: string;
  personType: string | null;
  department: string;
  personAgency: string | null;
  legalEntity: string;
  peopleGroup: string;
  percentage: number;
  parStartDate: string;
  parEndDate: string;
  segments: SegmentValues;
}

export interface PersonElementRow extends PersonRow {
  element: string;
}

export interface PositionRow {
  id: string;
  enterpriseId: string | null;
  positionCode: string;
  positionName: string;
  effStartDate: string;
  effEndDate: string;
  segments: SegmentValues;
}

export interface JobRow {
  id: string;
  enterpriseId: string | null;
  jobCode: string;
  jobName: string;
  effStartDate: string;
  effEndDate: string;
  segments: SegmentValues;
}

export interface PayrollRow {
  id: string;
  enterpriseId: string | null;
  payrollDefinition: string;
  effStartDate: string;
  effEndDate: string;
  segments: SegmentValues;
}

export interface FastFormulaRow {
  id: string;
  enterpriseId: string | null;
  key: string;
  element: string;
  priorityRank: number;
  legalEntity: string | null;
  peopleGroup1: string | null;
  peopleGroup2: string | null;
  personAgency: string | null;
  personType: string | null;
  contractClause: string | null;
  startDate: string;
  endDate: string;
  segments: SegmentValues;
}

export interface IacPpgRow {
  id: string;
  enterpriseId: string | null;
  legalEntity: string;
  peopleGroupSegment: string;
  element: string;
  accountType: "Cost" | "Offset" | "Both";
  isActive: boolean;
  startDate: string;
  endDate: string;
  segments: SegmentValues;
}

export interface IacSegRow {
  id: string;
  enterpriseId: string | null;
  legalEntity: string;
  accountType: "Cost" | "Offset" | "Both";
  segment: string; // "Segment 1" … "Segment 9"
  oldValue: string | null;
  newValue: string | null;
  startDate: string;
  endDate: string;
}

export interface ValidCombination {
  id: string;
  enterpriseId: string | null;
  legalEmployer: string;
  peopleGroup1: string;
  peopleGroup2: string;
  peopleGroup3: string | null;
}

// ── ETL ───────────────────────────────────────────────────────────────────────
export type EtlTargetTable =
  | "eligibility"
  | "department"
  | "person"
  | "person_element"
  | "position"
  | "job"
  | "payroll"
  | "fast_formula"
  | "iac_ppg"
  | "iac_seg"
  | "valid_combinations"
  | "list_of_values";

export interface EtlJobConfig {
  targetTable: EtlTargetTable;
  enterpriseId: string;
}

// ── Service token (Platform → CostSimulator) ─────────────────────────────────
export interface CostSimPermissions {
  viewSimulate: boolean;       // Costing Visualizer + Eligibility + Combinations + Interagency
  viewInteragency: boolean;    // Costing Combinations – Interagency only (Costsim-Agency)
  manageData: boolean;         // Upload/sync source data tables (Costsim-Enterprise)
}

export interface CostSimServiceToken {
  sub: string;
  enterpriseId: string | null;
  enterpriseName: string;
  permissions: CostSimPermissions;
  isPlatformAdmin: boolean;
  iat: number;
  exp: number;
}

// ── API envelope ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
