/**
 * Pure costing resolution engine.
 * Takes all 9 source datasets (already fetched, enterprise-scoped) and
 * returns the 9-rank cost ladder + journal lines.  No DB calls here —
 * all data is passed in so this stays unit-testable and stateless.
 */
import type { SegmentValues, SimulationInput } from "@costsim/types";

type Row9 = { seg1:string|null;seg2:string|null;seg3:string|null;seg4:string|null;seg5:string|null;seg6:string|null;seg7:string|null;seg8:string|null;seg9:string|null };

const norm = (v: unknown): string | null =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim();

const segs = (r: Row9): SegmentValues =>
  [norm(r.seg1),norm(r.seg2),norm(r.seg3),norm(r.seg4),norm(r.seg5),norm(r.seg6),norm(r.seg7),norm(r.seg8),norm(r.seg9)];

const blank = (v: string | null): boolean => v === null;

const pd = (s: string): Date | null => {
  if (!s) return null;
  const [d,m,y] = s.split("/").map(Number);
  return new Date(y ?? +s.split("-")[0], (m ?? +s.split("-")[1])-1, d ?? +s.split("-")[2]);
};

export function inRange(date: Date, start: string, end: string): boolean {
  const a = pd(start), b = pd(end);
  return (!a || date >= a) && (!b || date <= b);
}

const anyMatch = (v: string | null, x: string | null): boolean =>
  !v || v === "ANY" || (!blank(x) && v === x);

export interface EligRow extends Row9 {
  eligibility: string;
  elementName: string;
  accountType: string;
  eligibilityStartDate: string;
  eligibilityEndDate: string;
  legalEmployer: string | null;
  peopleGroup1: string | null;
  peopleGroup2: string | null;
  peopleGroup3: string | null;
}

export interface FFRow extends Row9 {
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
}

export interface DeptRow extends Row9 { deptName: string; effStartDate: string; effEndDate: string; }
export interface PersonRow extends Row9 { assignmentNumber: string; parStartDate: string; parEndDate: string; legalEntity: string; peopleGroup: string; personAgency: string | null; personType: string | null; }
export interface PersonElemRow extends PersonRow { element: string; }
export interface PositionRow extends Row9 { positionCode: string; positionName: string; effStartDate: string; effEndDate: string; }
export interface JobRow extends Row9 { jobCode: string; jobName: string; effStartDate: string; effEndDate: string; }
export interface PayrollRow extends Row9 { payrollDefinition: string; effStartDate: string; effEndDate: string; }
export interface IacPpgRow extends Row9 { legalEntity: string; peopleGroupSegment: string; element: string; accountType: string; isActive: boolean; startDate: string; endDate: string; }
export interface IacSegRow { legalEntity: string; accountType: string; segment: string; oldValue: string | null; newValue: string | null; startDate: string; endDate: string; }

export interface DataSources {
  eligibility: EligRow[];
  department: DeptRow[];
  person: PersonRow[];
  personElement: PersonElemRow[];
  position: PositionRow[];
  job: JobRow[];
  payroll: PayrollRow[];
  fastFormula: FFRow[];
  iacPpg: IacPpgRow[];
  iacSeg: IacSegRow[];
}

export interface HierarchyLevel {
  rank: number;
  name: string;
  sub: string;
  sourceId: string | null;
  segments: SegmentValues | null;
  editable?: boolean;
  cls?: string;
}

export interface JournalLine {
  type: "Cost" | "Offset";
  segments: SegmentValues;
  levels: HierarchyLevel[];
}

export interface SimResult {
  eligible: boolean;
  eligibilityRecord: string | null;
  cost: JournalLine | null;
  offset: JournalLine | null;
  traceMessages: string[];
}

function specScore(r: EligRow): number {
  return [r.legalEmployer, r.peopleGroup1, r.peopleGroup2, r.peopleGroup3].filter(v => !blank(v)).length;
}

function matchEligibility(
  data: EligRow[], elem: string, acctType: string,
  le: string, pg1: string, pg2: string, pg3: string | null, date: Date
): EligRow | null {
  const cands = data.filter(r =>
    r.elementName === elem && r.accountType === acctType &&
    inRange(date, r.eligibilityStartDate, r.eligibilityEndDate) &&
    anyMatch(r.legalEmployer, le) && anyMatch(r.peopleGroup1, pg1) &&
    anyMatch(r.peopleGroup2, pg2) && anyMatch(r.peopleGroup3, pg3));
  cands.sort((a,b) => specScore(b) - specScore(a));
  return cands[0] ?? null;
}

/** Segment-level merge: walk levels in rank order, pick first non-null per segment. */
function merge(levels: HierarchyLevel[]): SegmentValues {
  return Array.from({ length: 9 }, (_, i) => {
    for (const L of levels) {
      if (L.segments && !blank(L.segments[i])) return L.segments[i];
    }
    return null;
  }) as SegmentValues;
}

export function runSimulation(input: SimulationInput, data: DataSources): SimResult {
  const date = new Date(input.effectiveDate + "T00:00:00");
  const trace: string[] = [];

  // ── Gate: eligibility ────────────────────────────────────────────────────
  const elCost = matchEligibility(data.eligibility, input.elementName, "Cost Account",
    input.legalEntity, input.peopleGroup1, input.peopleGroup2, input.peopleGroup3 ?? null, date);

  if (!elCost) {
    trace.push(`✖ Eligibility: no record for ${input.elementName} matches LE / PG1 / PG2 / PG3`);
    return { eligible: false, eligibilityRecord: null, cost: null, offset: null, traceMessages: trace };
  }
  trace.push(`✔ Eligibility: ${elCost.eligibility}`);

  // ── Rank 1: Fast Formula ─────────────────────────────────────────────────
  const ffMatches = data.fastFormula.filter(r =>
    r.element === input.elementName &&
    inRange(date, r.startDate, r.endDate) &&
    anyMatch(r.legalEntity, input.legalEntity) &&
    anyMatch(r.peopleGroup1, input.peopleGroup1) &&
    anyMatch(r.peopleGroup2, input.peopleGroup2) &&
    anyMatch(r.personAgency, input.agency) &&
    anyMatch(r.contractClause, input.contractClause ?? null)
  ).sort((a,b) => a.priorityRank - b.priorityRank);
  const ff = ffMatches[0] ?? null;
  trace.push(ff ? `✔ Fast formula override: ${ff.key} (rank ${ff.priorityRank})` : `– Fast formula: no rule satisfied`);

  // ── Rank 3: Person–Element ───────────────────────────────────────────────
  const persElem = input.assignmentNumber
    ? data.personElement.find(r => r.assignmentNumber === input.assignmentNumber &&
        r.element === input.elementName &&
        inRange(date, r.parStartDate, r.parEndDate)) ?? null
    : null;
  trace.push(persElem ? `✔ Person–Element: ${persElem.assignmentNumber}` : `– Person–Element: no match`);

  // ── Rank 4: Person–Assignment ────────────────────────────────────────────
  const person = input.assignmentNumber
    ? data.person.find(r => r.assignmentNumber === input.assignmentNumber &&
        inRange(date, r.parStartDate, r.parEndDate)) ?? null
    : null;
  trace.push(person ? `✔ Person–Assignment: ${person.assignmentNumber}` : `– Person–Assignment: no match`);

  // ── Rank 5: Position ─────────────────────────────────────────────────────
  const pos = input.positionCode
    ? data.position.find(r => r.positionCode === input.positionCode &&
        inRange(date, r.effStartDate, r.effEndDate)) ?? null
    : null;
  trace.push(pos ? `✔ Position: ${pos.positionCode} – ${pos.positionName}` : `– Position: no match`);

  // ── Rank 6: Job ──────────────────────────────────────────────────────────
  const job = input.jobCode
    ? data.job.find(r => r.jobCode === input.jobCode &&
        inRange(date, r.effStartDate, r.effEndDate)) ?? null
    : null;
  trace.push(job ? `✔ Job: ${job.jobCode} – ${job.jobName}` : `– Job: no match`);

  // ── Rank 7: Department ───────────────────────────────────────────────────
  const dept = data.department.filter(r =>
    r.deptName === input.department && inRange(date, r.effStartDate, r.effEndDate));
  trace.push(dept.length ? `✔ Department: ${dept[0]!.deptName}` : `– Department: no match`);

  // ── Rank 9: Payroll ──────────────────────────────────────────────────────
  const payroll = input.payrollDefinition
    ? data.payroll.find(r => r.payrollDefinition === input.payrollDefinition &&
        inRange(date, r.effStartDate, r.effEndDate)) ?? null
    : null;
  trace.push(payroll ? `✔ Payroll: ${payroll.payrollDefinition}` : `– Payroll: no match`);

  const levels: HierarchyLevel[] = [
    { rank:1, name:"Fast formula override",          sub:"04 · lowest satisfied rank",               sourceId: ff?.key ?? null,                    segments: ff       ? segs(ff)       : null, cls:"override" },
    { rank:2, name:"Element entry costing",           sub:"entered on the element entry",              sourceId: input.elementName,                  segments: [null,null,null,null,null,null,null,null,null], editable:true },
    { rank:3, name:"Costing for person · element",    sub:"Costing For Person-Element",               sourceId: persElem?.assignmentNumber ?? null,  segments: persElem ? segs(persElem) : null },
    { rank:4, name:"Costing for person · assignment", sub:"03 · assignment costing",                  sourceId: person?.assignmentNumber ?? null,    segments: person   ? segs(person)   : null },
    { rank:5, name:"Costing for position",            sub:`Costing of Position · ${pos?.positionName ?? input.positionCode ?? "—"}`, sourceId: pos?.positionCode ?? null, segments: pos ? segs(pos) : null },
    { rank:6, name:"Costing for job",                 sub:`Costing of Job · ${job?.jobName ?? input.jobCode ?? "—"}`, sourceId: job?.jobCode ?? null, segments: job ? segs(job) : null },
    { rank:7, name:"Costing for department",          sub:"02 · department costing",                  sourceId: dept[0]?.deptName ?? null,           segments: dept[0]  ? segs(dept[0])  : null },
    { rank:8, name:"Element eligibility costing",     sub:"01 · cost account",                        sourceId: elCost.eligibility,                  segments: segs(elCost) },
    { rank:9, name:"Costing for payroll",             sub:`Costing of Payroll · ${payroll?.payrollDefinition ?? input.payrollDefinition ?? "—"}`, sourceId: payroll?.payrollDefinition ?? null, segments: payroll ? segs(payroll) : null },
  ];

  const costSegs = merge(levels);

  // ── Offset ───────────────────────────────────────────────────────────────
  const elOff = matchEligibility(data.eligibility, input.elementName, "Offset Account",
    input.legalEntity, input.peopleGroup1, input.peopleGroup2, input.peopleGroup3 ?? null, date);
  const offLevels: HierarchyLevel[] = [
    { rank:1, name:"Element eligibility costing", sub:"01 · offset account", sourceId: elOff?.eligibility ?? null, segments: elOff ? segs(elOff) : null },
    { rank:2, name:"Final cost account",           sub:"the line above",      sourceId: "—",                        segments: costSegs },
  ];
  const offSegs = merge(offLevels);

  return {
    eligible: true,
    eligibilityRecord: elCost.eligibility,
    cost:   { type:"Cost",   segments: costSegs, levels },
    offset: { type:"Offset", segments: offSegs,  levels: offLevels },
    traceMessages: trace,
  };
}
