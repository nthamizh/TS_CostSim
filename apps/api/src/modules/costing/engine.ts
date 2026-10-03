/**
 * Pure costing resolution engine — 16-level hierarchy.
 * All logic lives here — no DB calls, fully testable.
 * Used by: /simulate, /eligibility, /combinations, /interagency.
 *
 * COST JOURNAL LINE (when costableType = Costed AND element !contains " Retro"):
 *
 *  Lvl  Table        costingType  costingSubType  Notes
 *  16   Department   ORG          SUSP            Null-fill: any seg still null after lvl 1–15
 *  15   Payroll      PAY          SUSP            Null-fill: any seg still null after lvl 1–14
 *  14   Department   ORG          DFLT            Remainder when split dept pct < 100
 *  13   Payroll      PAY          DFLT            Remainder when split payroll pct < 100
 *  12   Eligibility  EL           OVERRIDE        Split by pct, ordered by subTypeSequence
 *  11   Fast Formula FF           COST            Always 100%
 *  10   Element entry EE          COST            Always 100% (editable on element entry)
 *   9   Person Elem  AET          COST            Split by pct, ordered by subTypeSequence
 *   8   Person Elem  PRET         COST            Split by pct, ordered by subTypeSequence
 *   7   Person       ASG          COST            Split by pct, ordered by subTypeSequence
 *   6   Person       PREL         COST            Split by pct, ordered by subTypeSequence
 *   5   Position     POS          COST            Split by pct, ordered by subTypeSequence
 *   4   Job          JOB          COST            Split by pct, ordered by subTypeSequence
 *   3   Department   ORG          COST            Split by pct, ordered by subTypeSequence
 *   2   Eligibility  EL           COST            Always 100%
 *   1   Payroll      PAY          COST            Always 100%
 *
 * BALANCE (OFFSET) JOURNAL LINE:
 *  Lvl 2  Cost journal line (mirror of cost segments)
 *  Lvl 1  Eligibility EL BAL — always 100%, overrides cost segments per-segment
 */

import type { SimulationInput } from "@costsim/types";

export const SEGMENT_NAMES = [
  "Agency","Operating Unit","Fund","Cost Centre",
  "Account","Project","Donor","Interagency","Future",
] as const;

type Row9 = {
  seg1:string|null; seg2:string|null; seg3:string|null;
  seg4:string|null; seg5:string|null; seg6:string|null;
  seg7:string|null; seg8:string|null; seg9:string|null;
};

const norm = (v: unknown): string|null =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim();

const segs = (r: Row9) =>
  [norm(r.seg1),norm(r.seg2),norm(r.seg3),norm(r.seg4),norm(r.seg5),
   norm(r.seg6),norm(r.seg7),norm(r.seg8),norm(r.seg9)] as (string|null)[];

export const blank = (v: string|null|undefined): boolean => v === null || v === undefined;

const pd = (s: string): Date|null => {
  if (!s) return null;
  if (s.includes("/")) {
    const [d,m,y] = s.split("/").map(Number);
    return new Date(y!,m!-1,d!);
  }
  return new Date(s + "T00:00:00");
};

export const inRange = (date: Date, start: string, end: string): boolean => {
  const a = pd(start), b = pd(end);
  return (!a || date >= a) && (!b || date <= b);
};

const anyMatch = (v: string|null|undefined, x: string|null|undefined): boolean =>
  !v || v === "ANY" || (!blank(x) && v === x);

// ── Row type interfaces ───────────────────────────────────────────────────────

export interface EligRow extends Row9 {
  id: string;
  eligibility: string; elementName: string;
  costingSubType: string;   // "COST" | "BAL" | "OVERRIDE"
  costableType: string|null; // "Costed" | "Fixed" | "Distributed"
  ldg: string|null; subTypeSequence: string|null; percentage: number|null;
  eligibilityStartDate: string; eligibilityEndDate: string;
  legalEmployer: string|null; peopleGroup1: string|null;
  peopleGroup2: string|null;  peopleGroup3: string|null;
}
export interface DeptRow extends Row9 {
  deptName: string; effStartDate: string; effEndDate: string;
  costingType: string|null;    // "ORG"
  costingSubType: string|null; // "COST" | "SUSP" | "DFLT"
  subTypeSequence: string|null;
  percentage?: number|null;
  dSeg1?: string|null; dSeg2?: string|null; dSeg3?: string|null;
  dSeg4?: string|null; dSeg5?: string|null; dSeg6?: string|null;
  dSeg7?: string|null; dSeg8?: string|null; dSeg9?: string|null;
}
export interface PersonRow extends Row9 {
  assignmentNumber: string; legalEntity: string; peopleGroup: string;
  personAgency: string|null; personType: string|null; department: string;
  costingType: string|null;    // "PREL" | "ASG" | "TERM"
  costingSubType: string|null; // "COST"
  subTypeSequence: string|null;
  parStartDate: string; parEndDate: string; percentage?: number|null;
}
export interface PersonElemRow extends PersonRow {
  element: string;
  // costingType: "PRET" | "AET" | "TET"
}
export interface PositionRow extends Row9 {
  positionCode: string; positionName: string;
  costingType: string|null;    // "POS"
  costingSubType: string|null; // "COST"
  subTypeSequence: string|null;
  effStartDate: string; effEndDate: string; percentage?: number|null;
}
export interface JobRow extends Row9 {
  jobCode: string; jobName: string;
  costingType: string|null;    // "JOB"
  costingSubType: string|null; // "COST"
  subTypeSequence: string|null;
  effStartDate: string; effEndDate: string; percentage?: number|null;
}
export interface PayrollRow extends Row9 {
  payrollDefinition: string; effStartDate: string; effEndDate: string;
  costingType: string|null;    // "PAY"
  costingSubType: string|null; // "COST" | "SUSP" | "DFLT"
  subTypeSequence: string|null;
}
export interface ElementEntryRow extends Row9 {
  assignmentNumber: string; element: string;
  costingType: string|null;    // "EE"
  costingSubType: string|null; // "COST"
  subTypeSequence: string|null;
  parStartDate: string; parEndDate: string; percentage?: number|null;
}
export interface FFRow extends Row9 {
  key: string; element: string; priorityRank: number;
  legalEntity: string|null; peopleGroup1: string|null; peopleGroup2: string|null;
  personAgency: string|null; personType: string|null; contractClause: string|null;
  startDate: string; endDate: string;
}
export interface IacPpgRow extends Row9 {
  id: string; legalEntity: string; peopleGroupSegment: string;
  element: string; accountType: string; isActive: boolean;
  startDate: string; endDate: string;
}
export interface IacSegRow {
  id: string; legalEntity: string; accountType: string;
  segment: string; oldValue: string|null; newValue: string|null;
  startDate: string; endDate: string;
}
export interface ComboRow {
  id: string; legalEmployer: string; peopleGroup1: string;
  peopleGroup2: string; peopleGroup3: string|null;
}
export interface LovRow { category: string; value: string; sortOrder: number; }

export interface RankMask {
  rank: number;
  excludedSegs: number[];
}

export interface DataSources {
  eligibility:   EligRow[];
  department:    DeptRow[];
  person:        PersonRow[];
  personElement: PersonElemRow[];
  elementEntry:  ElementEntryRow[];
  position:      PositionRow[];
  job:           JobRow[];
  payroll:       PayrollRow[];
  fastFormula:   FFRow[];
  iacPpg:        IacPpgRow[];
  iacSeg:        IacSegRow[];
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface HierarchyLevel {
  rank: number; name: string; sub: string;
  sourceId: string|null; segments: (string|null)[]|null;
  editable?: boolean; cls?: string;
}

/** One journal line. Segments are already merged across levels. */
export interface CostLine {
  level:       number;          // owning / highest contributing level (1–16)
  levelLabel:  string;          // e.g. "Lvl 7 ASG COST"
  percentage:  number;          // 0–100
  sourceLabel: string;
  segments:    (string|null)[];
  isDefault:   boolean;         // DFLT / SUSP line
  costingType:    string;       // PAY | ORG | EL | FF | EE | JOB | POS | PREL | ASG | PRET | AET
  costingSubType: string;       // COST | BAL | OVERRIDE | SUSP | DFLT
  segLevels:   (number|null)[]; // level that supplied each segment (null = unresolved)
  segSources:  (string|null)[]; // e.g. "ASG COST", "EL BAL"
}

export interface LevelResult {
  level:      number;
  matched:    boolean;          // source data found for this level
  considered: boolean;          // false = unticked, inactive in Setup, or not applicable (retro)
  userValue:  boolean;
  lines:      CostLine[];       // raw rows at this level (before cross-level merge)
  usedMask:   boolean[][];      // [line][segment] = this cell supplied the final value
}

export interface JournalLine {
  type: "Cost"|"Offset";
  lines: CostLine[];
  segments: (string|null)[];    // first line's segments — backwards compat
  levels: HierarchyLevel[];
}

export interface EligibilityCandidate {
  eligibility: string;
  legalEmployer: string|null; peopleGroup1: string|null;
  peopleGroup2: string|null;  peopleGroup3: string|null;
  startDate: string; endDate: string;
}
/** Why an element is not eligible, and which records would make it eligible. */
export interface EligibilityDiagnostics {
  reason: "no-element" | "no-cost-record" | "out-of-date" | "filters";
  message: string;
  candidates: EligibilityCandidate[];   // de-duplicated, capped
  totalCandidates: number;
}

export interface SimResult {
  eligible:          boolean;
  eligibilityRecord: string|null;
  isRetro:           boolean;
  winnerLevel:       number|null;
  costableType:      string|null;   // from the EL COST record
  diagnostics:       EligibilityDiagnostics|null;   // set only when not eligible
  cost:              JournalLine|null;
  offset:            JournalLine|null;
  levelResults:      LevelResult[];
  traceMessages:     string[];
}

export type SegSource = "ff"|"pers"|"dept"|"elig"|"cost"|"ppg"|"segov"|"override"|"susp"|"dflt"|"";
export interface ResolvedSeg { v: string|null; s: SegSource; old?: string|null; }

// ── Level metadata ────────────────────────────────────────────────────────────

export const LEVEL_META: Record<number, { type: string; sub: string; label: string }> = {
  1:  { type:"PAY",  sub:"COST",     label:"Payroll" },
  2:  { type:"EL",   sub:"COST",     label:"Eligibility" },
  3:  { type:"ORG",  sub:"COST",     label:"Department" },
  4:  { type:"JOB",  sub:"COST",     label:"Job" },
  5:  { type:"POS",  sub:"COST",     label:"Position" },
  6:  { type:"PREL", sub:"COST",     label:"Person (PREL)" },
  7:  { type:"ASG",  sub:"COST",     label:"Person (ASG)" },
  8:  { type:"PRET", sub:"COST",     label:"Person-element (PRET)" },
  9:  { type:"AET",  sub:"COST",     label:"Person-element (AET)" },
  10: { type:"EE",   sub:"COST",     label:"Element entry" },
  11: { type:"FF",   sub:"COST",     label:"Fast formula" },
  12: { type:"EL",   sub:"OVERRIDE", label:"Eligibility override" },
  13: { type:"PAY",  sub:"DFLT",     label:"Payroll default" },
  14: { type:"ORG",  sub:"DFLT",     label:"Department default" },
  15: { type:"PAY",  sub:"SUSP",     label:"Payroll suspense" },
  16: { type:"ORG",  sub:"SUSP",     label:"Department suspense" },
};
const ALL_LEVELS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
/** Levels that may carry several percentage rows. The highest one present owns the split. */
const SPLIT_OWNER_ORDER = [12, 9, 8, 7, 6, 5, 4, 3];
/** Priority for the per-segment waterfall: highest priority first. */
const WATERFALL = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// ── Helpers ───────────────────────────────────────────────────────────────────

function seqNum(r: { subTypeSequence?: string|null }): number {
  const n = Number(r.subTypeSequence ?? "0");
  return isNaN(n) ? 0 : n;
}
function sortBySeq<T extends { subTypeSequence?: string|null }>(rows: T[]): T[] {
  return [...rows].sort((a,b) => seqNum(a) - seqNum(b));
}
function specScore(r: EligRow): number {
  return [r.legalEmployer,r.peopleGroup1,r.peopleGroup2,r.peopleGroup3]
    .filter(v => !blank(v)).length;
}

/** Eligibility rows for an element + sub-type, date-bound and LE/PG-compatible. */
function matchEligRows(
  data: EligRow[], elem: string, subType: string,
  le: string, pg1: string, pg2: string, pg3: string|null, date: Date,
): EligRow[] {
  const w = (v: string|null, x: string|null) => blank(v) || v === x;
  const cands = data.filter(r =>
    r.elementName === elem && r.costingSubType === subType &&
    inRange(date, r.eligibilityStartDate, r.eligibilityEndDate) &&
    w(r.legalEmployer, le) && w(r.peopleGroup1, pg1) &&
    w(r.peopleGroup2, pg2) && w(r.peopleGroup3, pg3 ?? "")
  );
  cands.sort((a,b) => specScore(b) - specScore(a));
  return cands;
}

export function matchEligibility(
  data: EligRow[], elem: string, subType: string,
  le: string, pg1: string, pg2: string, pg3: string|null, date: Date,
): EligRow|null {
  return matchEligRows(data, elem, subType, le, pg1, pg2, pg3, date)[0] ?? null;
}

function mkLine(
  level: number, pct: number, sourceLabel: string, segments: (string|null)[],
  type?: string, sub?: string,
): CostLine {
  const t = type ?? LEVEL_META[level]!.type;
  const s = sub  ?? LEVEL_META[level]!.sub;
  return {
    level, levelLabel: `Lvl ${level} ${t} ${s}`, percentage: pct, sourceLabel,
    segments, isDefault: s === "DFLT" || s === "SUSP", costingType: t, costingSubType: s,
    segLevels:  segments.map(v => blank(v) ? null : level),
    segSources: segments.map(v => blank(v) ? null : `${t} ${s}`),
  };
}

const EPS = 0.0001;

const CANDIDATE_CAP = 50;

function diagnoseEligibility(rows: EligRow[], elem: string, date: Date, dateLabel: string): EligibilityDiagnostics {
  const toCand = (r: EligRow): EligibilityCandidate => ({
    eligibility: r.eligibility, legalEmployer: r.legalEmployer, peopleGroup1: r.peopleGroup1,
    peopleGroup2: r.peopleGroup2, peopleGroup3: r.peopleGroup3,
    startDate: r.eligibilityStartDate, endDate: r.eligibilityEndDate,
  });
  const dedupe = (rs: EligRow[]) => {
    const seen = new Set<string>(), out: EligibilityCandidate[] = [];
    for (const r of rs) {
      const k = [r.legalEmployer, r.peopleGroup1, r.peopleGroup2, r.peopleGroup3, r.eligibilityStartDate].join("|");
      if (!seen.has(k)) { seen.add(k); out.push(toCand(r)); }
    }
    return out;
  };
  const forElem = rows.filter(r => r.elementName === elem);
  if (forElem.length === 0) {
    return { reason: "no-element", candidates: [], totalCandidates: 0,
             message: `No eligibility records exist for element "${elem}".` };
  }
  const cost = forElem.filter(r => r.costingSubType === "COST");
  if (cost.length === 0) {
    const found = [...new Set(forElem.map(r => r.costingSubType))].join(", ");
    return { reason: "no-cost-record", candidates: [], totalCandidates: 0,
             message: `"${elem}" has eligibility records (${found}) but none with sub-type COST, which is required.` };
  }
  const inDate = cost.filter(r => inRange(date, r.eligibilityStartDate, r.eligibilityEndDate));
  if (inDate.length === 0) {
    const all = dedupe(cost);
    const starts = cost.map(r => r.eligibilityStartDate).sort(), ends = cost.map(r => r.eligibilityEndDate).sort();
    return { reason: "out-of-date", candidates: all.slice(0, CANDIDATE_CAP), totalCandidates: all.length,
             message: `COST records exist for "${elem}" but none is effective on ${dateLabel} (they run from ${starts[0]} to ${ends[ends.length - 1]}).` };
  }
  const cands = dedupe(inDate);
  return { reason: "filters", candidates: cands.slice(0, CANDIDATE_CAP), totalCandidates: cands.length,
           message: `${cands.length} COST record${cands.length === 1 ? " is" : "s are"} effective on ${dateLabel}, but none matches the Legal employer / People group values entered. Choose one of the combinations below.` };
}

// ── 1. runSimulation ──────────────────────────────────────────────────────────

export function runSimulation(
  input: SimulationInput,
  data: DataSources,
  rankMasks: RankMask[] = [],
  activeLevels?: number[],
): SimResult {
  const date  = new Date(input.effectiveDate + "T00:00:00");
  const trace: string[] = [];
  const isRetro  = input.elementName.includes(" Retro");
  const excluded = new Set((input.excludedLevels ?? []).map(Number));
  const overrides: Record<string,(string|null)[]> = (input.userOverrides ?? {}) as any;
  const active   = activeLevels ? new Set(activeLevels) : new Set(ALL_LEVELS);
  const maskMap  = new Map<number, Set<number>>(rankMasks.map(m => [m.rank, new Set(m.excludedSegs)]));

  if (isRetro) trace.push("ℹ Retro element — levels 12–16 (OVERRIDE, DFLT, SUSP) do not apply");

  const le  = input.legalEntity  ?? "";
  const pg1 = input.peopleGroup1 ?? "";
  const pg2 = input.peopleGroup2 ?? "";
  const pg3 = input.peopleGroup3 ?? null;

  // Eligibility gate — an EL COST record must exist.
  const elCostRows = matchEligRows(data.eligibility, input.elementName, "COST", le, pg1, pg2, pg3, date);
  if (elCostRows.length === 0) {
    trace.push(`✖ Eligibility (EL COST): no record for "${input.elementName}" matches LE / PG1 / PG2 / PG3`);
    return { eligible:false, eligibilityRecord:null, isRetro, winnerLevel:null, costableType:null,
             diagnostics: diagnoseEligibility(data.eligibility, input.elementName, date, input.effectiveDate),
             cost:null, offset:null, levelResults:[], traceMessages:trace };
  }
  const elCost = elCostRows[0]!;
  trace.push(`✔ Eligibility (EL COST Lvl 2): ${elCost.eligibility}`);
  // The 16-level hierarchy is defined for Costed elements. Anything else (and legacy
  // placeholder values) is resolved the same way, but flagged so nobody trusts it blindly.
  const costableType = elCost.costableType === "Fixed" || elCost.costableType === "Distributed"
    ? elCost.costableType : "Costed";
  if (costableType !== "Costed") {
    trace.push(`⚠ Costable type is "${costableType}": the 16-level rules are defined for Costed elements only`);
  }

  // ── Collect raw rows per level ──────────────────────────────────────────────
  const raw: Record<number, CostLine[]> = {};
  for (const L of ALL_LEVELS) raw[L] = [];
  const S = segs;

  const payRows = input.payrollDefinition
    ? data.payroll.filter(r => r.payrollDefinition === input.payrollDefinition &&
        inRange(date, r.effStartDate, r.effEndDate)) : [];
  const payBy = (sub: string) => payRows.find(r => (r.costingSubType ?? "COST") === sub) ?? null;
  const deptRows = input.department
    ? data.department.filter(r => r.deptName === input.department &&
        inRange(date, r.effStartDate, r.effEndDate)) : [];
  const deptBy = (sub: string) => sortBySeq(deptRows.filter(r => (r.costingSubType ?? "COST") === sub));

  const pay = payBy("COST");
  if (pay) raw[1] = [mkLine(1, 100, `Payroll ${pay.payrollDefinition}`, S(pay))];
  raw[2] = [mkLine(2, 100, `Eligibility ${elCost.eligibility}`, S(elCost))];
  raw[3] = deptBy("COST").map(r => mkLine(3, r.percentage ?? 100, `Dept ${r.deptName}`, S(r)));

  if (input.jobCode) raw[4] = sortBySeq(data.job.filter(r => r.jobCode === input.jobCode &&
      (r.costingSubType ?? "COST") === "COST" && inRange(date, r.effStartDate, r.effEndDate)))
    .map(r => mkLine(4, r.percentage ?? 100, `Job ${r.jobCode}`, S(r)));
  if (input.positionCode) raw[5] = sortBySeq(data.position.filter(r => r.positionCode === input.positionCode &&
      (r.costingSubType ?? "COST") === "COST" && inRange(date, r.effStartDate, r.effEndDate)))
    .map(r => mkLine(5, r.percentage ?? 100, `Position ${r.positionCode}`, S(r)));

  const asg = input.assignmentNumber;
  // A blank costingType is legacy data: person rows are treated as ASG, person-element rows as AET.
  const personBy = (t: string, blankIs: boolean) => asg ? sortBySeq(data.person.filter(r =>
      r.assignmentNumber === asg && (r.costingSubType ?? "COST") === "COST" &&
      (r.costingType ? r.costingType === t : blankIs) &&
      inRange(date, r.parStartDate, r.parEndDate))) : [];
  const persElBy = (t: string, blankIs: boolean) => asg ? sortBySeq(data.personElement.filter(r =>
      r.assignmentNumber === asg && r.element === input.elementName &&
      (r.costingSubType ?? "COST") === "COST" &&
      (r.costingType ? r.costingType === t : blankIs) &&
      inRange(date, r.parStartDate, r.parEndDate))) : [];
  raw[6] = personBy("PREL", false).map(r => mkLine(6, r.percentage ?? 100, `Person PREL ${r.assignmentNumber}`, S(r)));
  raw[7] = personBy("ASG",  true ).map(r => mkLine(7, r.percentage ?? 100, `Person ASG ${r.assignmentNumber}`,  S(r)));
  raw[8] = persElBy("PRET", false).map(r => mkLine(8, r.percentage ?? 100, `Person-element PRET ${r.assignmentNumber}`, S(r)));
  raw[9] = persElBy("AET",  true ).map(r => mkLine(9, r.percentage ?? 100, `Person-element AET ${r.assignmentNumber}`,  S(r)));

  // Level 10 — element entry: always 100%, one row.
  const ee = asg ? sortBySeq((data.elementEntry ?? []).filter(r =>
      r.assignmentNumber === asg && r.element === input.elementName &&
      (r.costingSubType ?? "COST") === "COST" && inRange(date, r.parStartDate, r.parEndDate)))[0] ?? null : null;
  if (ee) raw[10] = [mkLine(10, 100, `Element entry ${ee.assignmentNumber}`, S(ee))];

  // Level 11 — fast formula: always 100%.
  const ff = data.fastFormula.filter(r =>
    r.element === input.elementName && inRange(date, r.startDate, r.endDate) &&
    anyMatch(r.legalEntity, le) && anyMatch(r.peopleGroup1, pg1) && anyMatch(r.peopleGroup2, pg2) &&
    anyMatch(r.personAgency, input.agency) && anyMatch(r.contractClause, input.contractClause ?? null)
  ).sort((a,b) => a.priorityRank - b.priorityRank)[0] ?? null;
  if (ff) raw[11] = [mkLine(11, 100, `Fast formula ${ff.key} (rank ${ff.priorityRank})`, S(ff))];

  // Level 12 — eligibility OVERRIDE: only the most specific rows form the split group.
  const ovAll = matchEligRows(data.eligibility, input.elementName, "OVERRIDE", le, pg1, pg2, pg3, date);
  const topSpec = ovAll.length ? specScore(ovAll[0]!) : 0;
  raw[12] = sortBySeq(ovAll.filter(r => specScore(r) === topSpec))
    .map(r => mkLine(12, r.percentage ?? 100, `Elig OVERRIDE ${r.eligibility}`, S(r)));

  // Levels 13–16 — default and suspense rows.
  const pd13 = payBy("DFLT"), pd15 = payBy("SUSP");
  const d14 = deptBy("DFLT")[0], d16 = deptBy("SUSP")[0];
  if (pd13) raw[13] = [mkLine(13, 100, `Payroll DFLT ${pd13.payrollDefinition}`, S(pd13))];
  if (d14)  raw[14] = [mkLine(14, 100, `Dept DFLT ${d14.deptName}`, S(d14))];
  if (pd15) raw[15] = [mkLine(15, 100, `Payroll SUSP ${pd15.payrollDefinition}`, S(pd15))];
  if (d16)  raw[16] = [mkLine(16, 100, `Dept SUSP ${d16.deptName}`, S(d16))];

  // User-entered values replace whatever the level resolved.
  const userLevels = new Set<number>();
  for (const [k, v] of Object.entries(overrides)) {
    const L = Number(k);
    if (!LEVEL_META[L] || !Array.isArray(v)) continue;
    userLevels.add(L);
    raw[L] = [mkLine(L, 100, "User value", v.map(norm))];
  }

  // A level contributes when it is active in Setup, ticked, applicable, and has data.
  const considered = (L: number) =>
    active.has(L) && !excluded.has(L) && !(isRetro && L >= 12);
  const contributes = (L: number) => considered(L) && raw[L]!.length > 0;
  for (const L of ALL_LEVELS) {
    trace.push(raw[L]!.length
      ? `${considered(L) ? "✔" : "–"} Lvl ${L} ${LEVEL_META[L]!.type} ${LEVEL_META[L]!.sub}: ${raw[L]!.length} row(s)${considered(L) ? "" : " (not considered)"}`
      : `– Lvl ${L} ${LEVEL_META[L]!.type} ${LEVEL_META[L]!.sub}: no match`);
  }

  // Segment value from the highest-priority contributing level.
  // `own` substitutes the line being resolved for its level's representative row.
  const pick = (i: number, order: number[], own?: { level: number; line: CostLine }) => {
    for (const L of order) {
      if (!contributes(L) || maskMap.get(L)?.has(i)) continue;
      const line = own && own.level === L ? own.line : raw[L]![0]!;
      const v = line.segments[i];
      if (!blank(v)) return { v: v!, level: L };
    }
    return null;
  };
  const resolve = (
    order: number[], own: { level: number; line: CostLine } | undefined,
    pct: number, label: string, ownerLevel: number|null,
  ): CostLine => {
    const segments: (string|null)[] = [], segLevels: (number|null)[] = [], segSources: (string|null)[] = [];
    for (let i = 0; i < 9; i++) {
      const r = pick(i, order, own);
      segments.push(r?.v ?? null);
      segLevels.push(r?.level ?? null);
      segSources.push(r ? `${LEVEL_META[r.level]!.type} ${LEVEL_META[r.level]!.sub}` : null);
    }
    const top = ownerLevel ?? Math.max(0, ...segLevels.filter((x): x is number => x !== null));
    const meta = LEVEL_META[top] ?? LEVEL_META[1]!;
    return { level: top, levelLabel: `Lvl ${top} ${meta.type} ${meta.sub}`, percentage: pct,
             sourceLabel: label, segments, isDefault: false,
             costingType: meta.type, costingSubType: meta.sub, segLevels, segSources };
  };

  // ── Cost journal lines ──────────────────────────────────────────────────────
  const owner = SPLIT_OWNER_ORDER.find(contributes) ?? null;
  let costLines: CostLine[] = [];
  if (owner === null) {
    costLines = [resolve(WATERFALL, undefined, 100, "100%", null)];
  } else {
    costLines = raw[owner]!.map(l => resolve(WATERFALL, { level: owner, line: l }, l.percentage, l.sourceLabel, owner));
    const total = costLines.reduce((s, l) => s + l.percentage, 0);
    if (total > 100 + EPS) trace.push(`⚠ Lvl ${owner} split totals ${total}% (over 100%)`);
    if (total < 100 - EPS && !isRetro) {
      const remain = Math.round((100 - total) * 1e6) / 1e6;
      const without = WATERFALL.filter(L => L !== owner);
      // Remainder takes the default COA (dept DFLT, then payroll DFLT), then falls back to the other levels.
      const dflt = [14, 13].filter(contributes);
      const line = resolve(without, undefined, remain,
        dflt.length ? `Default COA (${remain}%)` : `Remainder, no DFLT defined (${remain}%)`, null);
      for (let i = 0; i < 9; i++) {
        const d = dflt.find(L => !blank(raw[L]![0]!.segments[i]) && !maskMap.get(L)?.has(i));
        if (d !== undefined) {
          line.segments[i] = raw[d]![0]!.segments[i]!;
          line.segLevels[i] = d;
          line.segSources[i] = `${LEVEL_META[d]!.type} ${LEVEL_META[d]!.sub}`;
        }
      }
      const top = dflt[0] ?? Math.max(0, ...line.segLevels.filter((x): x is number => x !== null));
      const meta = LEVEL_META[top] ?? LEVEL_META[1]!;
      line.level = top; line.levelLabel = `Lvl ${top} ${meta.type} ${meta.sub}`;
      line.costingType = meta.type; line.costingSubType = dflt.length ? "DFLT" : meta.sub;
      line.isDefault = true;
      costLines.push(line);
      trace.push(dflt.length
        ? `✔ ${remain}% remainder from default COA (Lvl ${dflt[0]})`
        : `⚠ ${remain}% remainder but no DFLT row defined — filled from other levels`);
    }
  }

  // Suspense fills null segments only: dept SUSP (16) first, then payroll SUSP (15).
  if (!isRetro) {
    for (const line of costLines) {
      for (let i = 0; i < 9; i++) {
        if (!blank(line.segments[i])) continue;
        const s = [16, 15].find(L => contributes(L) && !maskMap.get(L)?.has(i) && !blank(raw[L]![0]!.segments[i]));
        if (s !== undefined) {
          line.segments[i] = raw[s]![0]!.segments[i]!;
          line.segLevels[i] = s;
          line.segSources[i] = `${LEVEL_META[s]!.type} SUSP`;
        }
      }
    }
    const filled = costLines.some(l => l.segLevels.some(x => x === 15 || x === 16));
    if (filled) trace.push("✔ Suspense (Lvl 15/16) filled unresolved segments");
  }
  for (const l of costLines) {
    l.segLevels.forEach((lv, i) => { if (lv === null) trace.push(`⚠ Segment ${i + 1}: unresolved`); });
    break;
  }

  // ── Balance (offset) lines: EL BAL overrides per segment, else mirror cost ──
  const elBal = matchEligibility(data.eligibility, input.elementName, "BAL", le, pg1, pg2, pg3, date);
  const bal   = elBal ? S(elBal) : (Array(9).fill(null) as (string|null)[]);
  trace.push(elBal ? `✔ Eligibility BAL (balance Lvl 1): ${elBal.eligibility}`
                   : "– Eligibility BAL: none — balance mirrors cost");
  const offsetLines: CostLine[] = costLines.map(cl => {
    const segments = cl.segments.map((v, i) => !blank(bal[i]) ? bal[i]! : v);
    const fromBal  = cl.segments.map((_, i) => !blank(bal[i]));
    return { ...cl, levelLabel: "Balance", costingSubType: "BAL", isDefault: cl.isDefault,
      segments,
      segLevels:  cl.segLevels.map((lv, i) => fromBal[i] ? 1 : lv),
      segSources: cl.segSources.map((s, i) => fromBal[i] ? "EL BAL" : s) };
  });

  // ── Per-level results for the UI ────────────────────────────────────────────
  const levelResults: LevelResult[] = ALL_LEVELS.map(L => {
    const lines = raw[L]!;
    const usedMask = lines.map((_, k) => Array.from({ length: 9 }, (_, i) =>
      L === owner ? costLines[k]?.segLevels[i] === L
                  : k === 0 && costLines.some(cl => cl.segLevels[i] === L)));
    return { level: L, matched: lines.length > 0, considered: considered(L),
             userValue: userLevels.has(L), lines, usedMask };
  });
  const used = costLines.flatMap(l => l.segLevels.filter((x): x is number => x !== null));
  const winnerLevel = owner ?? (used.length ? Math.max(...used) : null);

  const hier: HierarchyLevel[] = [...ALL_LEVELS].reverse().map(L => ({
    rank: L, name: LEVEL_META[L]!.label, sub: `${LEVEL_META[L]!.type} ${LEVEL_META[L]!.sub}`,
    sourceId: raw[L]![0]?.sourceLabel ?? null, segments: raw[L]![0]?.segments ?? null,
    editable: L === 10 && raw[10]!.length === 0,
  }));

  return {
    eligible: true, eligibilityRecord: elCost.eligibility, isRetro, winnerLevel, costableType, diagnostics: null,
    cost:   { type: "Cost",   lines: costLines,   segments: costLines[0]!.segments,   levels: hier },
    offset: { type: "Offset", lines: offsetLines, segments: offsetLines[0]!.segments, levels: hier },
    levelResults, traceMessages: trace,
  };
}

// ── 2. computeEligibilityGrid ─────────────────────────────────────────────────

export interface EligibilityRow {
  legalEmployer: string; peopleGroup1: string; peopleGroup2: string; peopleGroup3: string|null;
  eligible: boolean; eligibilityRecord: string|null;
  segments: (string|null)[];
  costingSubType: string;
  percentage: number|null;        // OVERRIDE split rows only
  subTypeSequence: string|null;
}

/**
 * One row per valid combination for COST and BAL. OVERRIDE can be split by percentage, so it
 * returns one row per split record, and only for combinations that actually have an override
 * (listing every combination as "no override" would just be noise).
 */
export function computeEligibilityGrid(
  combos: ComboRow[], elig: EligRow[],
  elem: string, acctType: string, date: Date
): EligibilityRow[] {
  const build = (c: ComboRow, m: EligRow|null): EligibilityRow => ({
    legalEmployer: c.legalEmployer, peopleGroup1: c.peopleGroup1,
    peopleGroup2: c.peopleGroup2,   peopleGroup3: c.peopleGroup3 ?? null,
    eligible: !!m,
    eligibilityRecord: m?.eligibility ?? null,
    segments: m ? segs(m) : Array(9).fill(null),
    costingSubType: acctType,
    percentage: m && acctType === "OVERRIDE" ? (m.percentage ?? 100) : null,
    subTypeSequence: m?.subTypeSequence ?? null,
  });
  const out: EligibilityRow[] = [];
  for (const c of combos) {
    const all = matchEligRows(elig, elem, acctType, c.legalEmployer, c.peopleGroup1, c.peopleGroup2, c.peopleGroup3 ?? null, date);
    if (acctType === "OVERRIDE") {
      const top = all.length ? specScore(all[0]!) : 0;
      sortBySeq(all.filter(r => specScore(r) === top)).forEach(r => out.push(build(c, r)));
    } else {
      out.push(build(c, all[0] ?? null));
    }
  }
  return out;
}

// ── 3. computeCombinationsGrid ────────────────────────────────────────────────

export interface ComboResultRow {
  legalEmployer: string; peopleGroup1: string; peopleGroup2: string; peopleGroup3: string|null;
  eligible: boolean; type: "Cost"|"Offset";
  ffRule: string|null; ffRank: number|null;
  personMatch: string|null; deptMatch: string|null;
  segments: ResolvedSeg[];
  deptSegments: (string|null)[];
  personSegments: (string|null)[];
}

export function computeCombinationsGrid(
  combos: ComboRow[], data: DataSources,
  opts: {
    elem: string; atype: "SCA agency"|"Partner Agency"|"Regular";
    agency: string|null; cc: string|null; date: Date;
    leFilter: string|null; pg1Filter: string|null; pg2Filter: string|null;
    costType: "Cost"|"Offset"|"Both";
    includeDept?: boolean;
    includePers?: boolean;
  }
): ComboResultRow[] {
  const { elem, atype, agency, cc, date, leFilter, pg1Filter, pg2Filter, costType,
          includeDept = false, includePers = false } = opts;
  const usePerson = atype === "SCA agency";

  const DEPT_PLACEHOLDER = [
    "Dept Agency","Dept Operating Unit","Dept Fund","Dept Cost Centre",
    null,
    "Dept Project","Dept Donor","Dept Interagency","Dept Future",
  ] as (string|null)[];
  const PERS_PLACEHOLDER = [
    "Pers Agency","Pers Operating Unit","Pers Fund","Pers Cost Centre",
    null,
    "Pers Project","Pers Donor","Pers Interagency","Pers Future",
  ] as (string|null)[];

  const out: ComboResultRow[] = [];

  for (const c of combos) {
    if (leFilter  && c.legalEmployer !== leFilter)  continue;
    if (pg1Filter && c.peopleGroup1  !== pg1Filter) continue;
    if (pg2Filter && c.peopleGroup2  !== pg2Filter) continue;

    const elRow    = matchEligibility(data.eligibility, elem, "COST", c.legalEmployer, c.peopleGroup1, c.peopleGroup2, c.peopleGroup3 ?? null, date);
    const elOffRow = matchEligibility(data.eligibility, elem, "BAL",  c.legalEmployer, c.peopleGroup1, c.peopleGroup2, c.peopleGroup3 ?? null, date);

    const personRow = usePerson
      ? data.person.find(r =>
          r.legalEntity === c.legalEmployer && r.peopleGroup === c.peopleGroup1 &&
          (!agency || r.personAgency === agency) &&
          inRange(date, r.parStartDate, r.parEndDate)) ?? null
      : null;

    const deptRow = personRow
      ? data.department.find(r => r.deptName === personRow.department && inRange(date, r.effStartDate, r.effEndDate)) ?? null
      : null;

    const ffRow = elRow
      ? data.fastFormula.filter(r =>
          r.element === elem && inRange(date, r.startDate, r.endDate) &&
          anyMatch(r.legalEntity, c.legalEmployer) && anyMatch(r.peopleGroup1, c.peopleGroup1) &&
          anyMatch(r.peopleGroup2, c.peopleGroup2) && anyMatch(r.personAgency, agency) &&
          anyMatch(r.contractClause, cc)
        ).sort((a,b) => a.priorityRank - b.priorityRank)[0] ?? null
      : null;

    const ffSegs_       = ffRow    ? segs(ffRow)    : Array(9).fill(null);
    const realPersSegs  = personRow ? segs(personRow) : Array(9).fill(null);
    const realDeptSegs  = deptRow   ? segs(deptRow)   : Array(9).fill(null);
    const persSegs: (string|null)[] = realPersSegs.some(v => v !== null)
      ? realPersSegs
      : (includePers ? PERS_PLACEHOLDER : Array(9).fill(null));
    const deptSegs: (string|null)[] = realDeptSegs.some(v => v !== null)
      ? realDeptSegs
      : (includeDept ? DEPT_PLACEHOLDER : Array(9).fill(null));

    const cost: ResolvedSeg[] = Array.from({length:9}, (_,i) => {
      if (!elRow) return { v: null, s: "" as SegSource };
      if (!blank(ffSegs_[i]))   return { v: ffSegs_[i],   s: "ff"   as SegSource };
      if (!blank(persSegs[i]))  return { v: persSegs[i],  s: "pers" as SegSource };
      if (!blank(deptSegs[i]))  return { v: deptSegs[i],  s: "dept" as SegSource };
      const e = segs(elRow)[i];
      return blank(e) ? { v: null, s: "" as SegSource } : { v: e!, s: "elig" as SegSource };
    });

    const offEligSegs = elOffRow ? segs(elOffRow) : Array(9).fill(null);
    const offset: ResolvedSeg[] = Array.from({length:9}, (_,i) => {
      if (!elRow) return { v: null, s: "" as SegSource };
      if (!blank(offEligSegs[i])) return { v: offEligSegs[i]!, s: "elig" as SegSource };
      return cost[i].v === null ? { v: null, s: "" as SegSource } : { v: cost[i].v, s: "cost" as SegSource };
    });

    const base = {
      legalEmployer: c.legalEmployer, peopleGroup1: c.peopleGroup1,
      peopleGroup2: c.peopleGroup2,   peopleGroup3: c.peopleGroup3 ?? null,
      eligible: !!elRow,
      ffRule: ffRow?.key ?? null, ffRank: ffRow?.priorityRank ?? null,
      personMatch: personRow?.assignmentNumber ?? null,
      deptMatch: deptRow?.deptName ?? null,
      deptSegments:  deptSegs,
      personSegments: persSegs,
    };

    if (costType !== "Offset") out.push({ ...base, type: "Cost",   segments: cost });
    if (costType !== "Cost")   out.push({ ...base, type: "Offset", segments: offset });
  }
  return out;
}

// ── 4. computeInteragencyGrid ─────────────────────────────────────────────────

export interface IacResultRow extends Omit<ComboResultRow, "segments"> {
  segments: ResolvedSeg[];
  overridesApplied: string[];
}

export function computeInteragencyGrid(
  combos: ComboRow[], data: DataSources,
  opts: {
    elem: string; ia: string;
    atype: "SCA agency"|"Partner Agency"|"Regular";
    agency: string|null; cc: string|null; date: Date;
    pg1Filter: string|null; pg2Filter: string|null;
    costType: "Cost"|"Offset"|"Both";
  }
): IacResultRow[] {
  const { elem, ia, atype, agency, cc, date, pg1Filter, pg2Filter, costType } = opts;
  const iaCombos = combos.filter(c => c.legalEmployer === ia);
  const baseRows = computeCombinationsGrid(iaCombos, data, {
    elem, atype, agency, cc, date,
    leFilter: null, pg1Filter, pg2Filter, costType: "Both",
  });

  const out: IacResultRow[] = [];

  for (const row of baseRows) {
    if (costType !== "Both" && row.type !== costType) continue;
    const pgKey = `${row.peopleGroup1}-${row.peopleGroup2}-${row.peopleGroup3 ?? ""}`;
    const type  = row.type;
    const final = row.segments;

    if (final.every(f => f.v === null)) {
      out.push({ ...row, overridesApplied: [] });
      continue;
    }

    const segOv = data.iacSeg.filter(r =>
      r.legalEntity === ia &&
      (r.accountType === "Both" || r.accountType === type) &&
      inRange(date, r.startDate, r.endDate)
    );
    const ppgOv = data.iacPpg.filter(r =>
      r.legalEntity === row.legalEmployer && r.element === elem &&
      r.isActive === true &&
      (r.accountType === "Both" || r.accountType === type) &&
      inRange(date, r.startDate, r.endDate) &&
      r.peopleGroupSegment.trim() === pgKey
    );

    const applied = new Set<string>();
    const iacSegs: ResolvedSeg[] = Array.from({length:9}, (_,i) => {
      const base = final[i].v;
      const p = ppgOv.find(r => !blank((r as any)[`seg${i+1}`] as string|null));
      if (p) {
        applied.add(`PPG EL #${p.id}`);
        return { v: norm((p as any)[`seg${i+1}`] as unknown), s: "ppg" as SegSource, old: base };
      }
      if (base === null) return { v: null, s: "" as SegSource, old: null };
      const so = segOv.find(r => r.segment === `Segment ${i+1}` && norm(r.oldValue) === base);
      if (so) {
        applied.add(`Segment #${so.id}`);
        return { v: norm(so.newValue), s: "segov" as SegSource, old: base };
      }
      return { v: base, s: "" as SegSource, old: null };
    });

    out.push({ ...row, segments: iacSegs, overridesApplied: [...applied] });
  }
  return out;
}

// ── 5. computeDropdowns ───────────────────────────────────────────────────────

export interface DropdownData {
  lov: Record<string, string[]>;
  elements: string[];
  assignments: string[];
  departments: string[];
  payrolls: string[];
  jobs: string[];
  positions: string[];
  interagencyLEs: string[];
}

const IA_EXCLUDED = new Set([
  "United Nations Development Programme",
  "United Nations Volunteers",
  "Multi-Partner Trust Fund Office",
]);

export function computeDropdowns(
  lovRows: LovRow[],
  data: Pick<DataSources, "eligibility"|"person"|"department"|"payroll"|"job"|"position">
): DropdownData {
  const lov: Record<string, string[]> = {};
  for (const r of lovRows) {
    if (!lov[r.category]) lov[r.category] = [];
    lov[r.category]!.push(r.value);
  }
  const uniq = <T>(a: T[]): T[] => [...new Set(a)].sort() as T[];
  const legalEmployers: string[] = lov["Legal Employer"] ?? [];
  return {
    lov,
    elements:    uniq(data.eligibility.map(r => r.elementName)),
    assignments: uniq(data.person.map(r => r.assignmentNumber)),
    departments: uniq(data.department.map(r => r.deptName)),
    payrolls:    uniq(data.payroll.map(r => r.payrollDefinition)),
    jobs:        uniq(data.job.map(r => r.jobCode)),
    positions:   uniq(data.position.map(r => r.positionCode)),
    interagencyLEs: legalEmployers.filter(le => !IA_EXCLUDED.has(le)),
  };
}
