/**
 * Pure costing resolution engine.
 * All logic lives here — no DB calls, fully testable.
 * Used by: /simulate, /eligibility, /combinations, /interagency.
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
  eligibility: string; elementName: string; accountType: string;
  eligibilityStartDate: string; eligibilityEndDate: string;
  legalEmployer: string|null; peopleGroup1: string|null;
  peopleGroup2: string|null;  peopleGroup3: string|null;
}
export interface DeptRow    extends Row9 {
  deptName: string; effStartDate: string; effEndDate: string;
  percentage?: number|null;
  dSeg1?: string|null; dSeg2?: string|null; dSeg3?: string|null;
  dSeg4?: string|null; dSeg5?: string|null; dSeg6?: string|null;
  dSeg7?: string|null; dSeg8?: string|null; dSeg9?: string|null;
}
export interface PersonRow  extends Row9 {
  assignmentNumber: string; legalEntity: string; peopleGroup: string;
  personAgency: string|null; personType: string|null; department: string;
  parStartDate: string; parEndDate: string; percentage?: number|null;
}
export interface PersonElemRow extends PersonRow { element: string; }
export interface PositionRow extends Row9 {
  positionCode: string; positionName: string;
  effStartDate: string; effEndDate: string; percentage?: number|null;
}
export interface JobRow     extends Row9 {
  jobCode: string; jobName: string;
  effStartDate: string; effEndDate: string; percentage?: number|null;
}
export interface PayrollRow extends Row9 { payrollDefinition: string; effStartDate: string; effEndDate: string; }
export interface FFRow      extends Row9 { key: string; element: string; priorityRank: number; legalEntity: string|null; peopleGroup1: string|null; peopleGroup2: string|null; personAgency: string|null; personType: string|null; contractClause: string|null; startDate: string; endDate: string; }
export interface IacPpgRow  extends Row9 { id: string; legalEntity: string; peopleGroupSegment: string; element: string; accountType: string; isActive: boolean; startDate: string; endDate: string; }
export interface IacSegRow  { id: string; legalEntity: string; accountType: string; segment: string; oldValue: string|null; newValue: string|null; startDate: string; endDate: string; }
export interface ComboRow   { id: string; legalEmployer: string; peopleGroup1: string; peopleGroup2: string; peopleGroup3: string|null; }
export interface LovRow     { category: string; value: string; sortOrder: number; }

export interface RankMask {
  rank: number;
  excludedSegs: number[];
}

export interface DataSources {
  eligibility:   EligRow[];
  department:    DeptRow[];
  person:        PersonRow[];
  personElement: PersonElemRow[];
  position:      PositionRow[];
  job:           JobRow[];
  payroll:       PayrollRow[];
  fastFormula:   FFRow[];
  iacPpg:        IacPpgRow[];
  iacSeg:        IacSegRow[];
}

// ── HierarchyLevel ────────────────────────────────────────────────────────────

export interface HierarchyLevel {
  rank: number; name: string; sub: string;
  sourceId: string|null; segments: (string|null)[]|null;
  editable?: boolean; cls?: string;
}

// ── Split-aware journal line ──────────────────────────────────────────────────
// A journal line may be split across multiple COA combinations (e.g. 50%/50%
// department costing). Each split is one CostLine within the JournalLine.

export interface CostLine {
  percentage: number;           // 0–100. 100 = single non-split line
  sourceLabel: string;          // e.g. "DEPT-OHR (50%)" or "100%"
  segments: (string|null)[];
  isDefault: boolean;           // true = this line is the dept/person default COA
}

export interface JournalLine {
  type: "Cost"|"Offset";
  lines: CostLine[];            // one entry for each split; single line = array of 1
  // Backwards-compatible: first line's segments (used by combinations grid)
  segments: (string|null)[];
  levels: HierarchyLevel[];
}

export interface SimResult {
  eligible: boolean; eligibilityRecord: string|null;
  cost: JournalLine|null; offset: JournalLine|null;
  traceMessages: string[];
}

// ── Shared: segment resolution sources ───────────────────────────────────────

export type SegSource = "ff"|"pers"|"dept"|"elig"|"cost"|"ppg"|"segov"|"";

export interface ResolvedSeg { v: string|null; s: SegSource; old?: string|null; }

// ── Internal helpers ──────────────────────────────────────────────────────────

function specScore(r: EligRow): number {
  return [r.legalEmployer,r.peopleGroup1,r.peopleGroup2,r.peopleGroup3]
    .filter(v => !blank(v)).length;
}

export function matchEligibility(
  data: EligRow[], elem: string, acctType: string,
  le: string, pg1: string, pg2: string, pg3: string|null, date: Date
): EligRow|null {
  const w = (v: string|null, x: string|null) => blank(v) || v === x;
  const cands = data.filter(r =>
    r.elementName === elem && r.accountType === acctType &&
    inRange(date, r.eligibilityStartDate, r.eligibilityEndDate) &&
    w(r.legalEmployer, le) && w(r.peopleGroup1, pg1) &&
    w(r.peopleGroup2, pg2) && w(r.peopleGroup3, pg3 ?? "")
  );
  cands.sort((a,b) => specScore(b) - specScore(a));
  return cands[0] ?? null;
}

/** Segment-wise merge: first non-null per index walking levels in order.
 *  rankMaskMap: rank → set of 0-based segment indices to skip for that rank. */
function merge(
  levels: HierarchyLevel[],
  rankMaskMap: Map<number, Set<number>> = new Map(),
): (string|null)[] {
  return Array.from({length:9}, (_,i) => {
    for (const L of levels) {
      if (!L.segments) continue;
      if (rankMaskMap.get(L.rank)?.has(i)) continue;
      if (!blank(L.segments[i])) return L.segments[i]!;
    }
    return null;
  });
}

/**
 * Resolve cost segments for one split row (dept / person / position / job).
 * Returns the merged segment array for that split.
 */
function resolveCostSegsForSplit(
  splitSegs: (string|null)[],
  ffSegs:    (string|null)[],
  eligSegs:  (string|null)[],
  splitRankExcluded: Set<number> = new Set(),
): (string|null)[] {
  return Array.from({length:9}, (_,i) => {
    if (!blank(ffSegs[i]))    return ffSegs[i]!;
    if (!splitRankExcluded.has(i) && !blank(splitSegs[i])) return splitSegs[i]!;
    if (!blank(eligSegs[i]))  return eligSegs[i]!;
    return null;
  });
}

/**
 * Build cost lines for a split-costing source.
 * splitRows — all matching rows for this source (e.g. all dept rows for a dept name)
 * If percentage < 100 and the row has dSeg columns, the remainder uses those as a
 * second line.  Returns one CostLine per split entry.
 */
function buildSplitLines(
  splitRows: (DeptRow|PersonRow|PersonElemRow|PositionRow|JobRow)[],
  ffSegs:    (string|null)[],
  eligSegs:  (string|null)[],
  labelFn:   (r: DeptRow|PersonRow|PersonElemRow|PositionRow|JobRow) => string,
  rankExcluded: Set<number> = new Set(),
): CostLine[] {
  if (splitRows.length === 0) return [];
  const lines: CostLine[] = [];
  let usedPct = 0;

  for (const row of splitRows) {
    const pct = row.percentage ?? 100;
    usedPct += pct;
    const mainSegs = resolveCostSegsForSplit(segs(row as Row9), ffSegs, eligSegs, rankExcluded);
    lines.push({
      percentage:  pct,
      sourceLabel: `${labelFn(row as any)} (${pct}%)`,
      segments:    mainSegs,
      isDefault:   false,
    });

    // If this row has a default COA (d_seg) and pct < 100, add the remainder line
    const dr = row as DeptRow;
    const hasDefault = pct < 100 && [
      dr.dSeg1,dr.dSeg2,dr.dSeg3,dr.dSeg4,dr.dSeg5,
      dr.dSeg6,dr.dSeg7,dr.dSeg8,dr.dSeg9,
    ].some(v => !blank(v));
    if (hasDefault) {
      const dSegs = [
        norm(dr.dSeg1),norm(dr.dSeg2),norm(dr.dSeg3),
        norm(dr.dSeg4),norm(dr.dSeg5),norm(dr.dSeg6),
        norm(dr.dSeg7),norm(dr.dSeg8),norm(dr.dSeg9),
      ] as (string|null)[];
      const remainPct = Math.max(0, 100 - usedPct);
      if (remainPct > 0 || splitRows.length === 1) {
        lines.push({
          percentage:  remainPct > 0 ? remainPct : 100 - pct,
          sourceLabel: `${labelFn(row as any)} — Default COA (${100 - pct}%)`,
          segments:    resolveCostSegsForSplit(dSegs, ffSegs, eligSegs, rankExcluded),
          isDefault:   true,
        });
      }
    }
  }

  // If total < 100 and no default COA rows, add a remainder line with elig segs
  if (usedPct < 100) {
    const remainPct = 100 - usedPct;
    const lastRow = splitRows[splitRows.length - 1] as DeptRow;
    const hasDefault = [
      lastRow.dSeg1,lastRow.dSeg2,lastRow.dSeg3,
    ].some(v => !blank(v));
    if (!hasDefault) {
      lines.push({
        percentage:  remainPct,
        sourceLabel: `Remainder — Eligibility costing (${remainPct}%)`,
        segments:    eligSegs,
        isDefault:   true,
      });
    }
  }

  return lines;
}

/**
 * Derive offset lines from cost lines.
 * Each cost line produces a corresponding offset line.
 * If the offset has its own eligibility segments, use those; otherwise mirror cost.
 */
function buildOffsetLines(
  costLines: CostLine[],
  offEligSegs: (string|null)[],
): CostLine[] {
  return costLines.map(cl => {
    const offSegs = Array.from({length:9}, (_,i) => {
      if (!blank(offEligSegs[i])) return offEligSegs[i]!;
      return cl.segments[i];
    }) as (string|null)[];
    return {
      percentage:  cl.percentage,
      sourceLabel: cl.sourceLabel,
      segments:    offSegs,
      isDefault:   cl.isDefault,
    };
  });
}

// ── 1. runSimulation ──────────────────────────────────────────────────────────

export function runSimulation(
  input: SimulationInput,
  data: DataSources,
  rankMasks: RankMask[] = [],
): SimResult {
  const date = new Date(input.effectiveDate + "T00:00:00");
  const trace: string[] = [];
  const rankMaskMap = new Map<number, Set<number>>(
    rankMasks.map(m => [m.rank, new Set(m.excludedSegs)])
  );

  const elCost = matchEligibility(data.eligibility, input.elementName, "Cost Account",
    input.legalEntity, input.peopleGroup1, input.peopleGroup2, input.peopleGroup3 ?? null, date);

  if (!elCost) {
    trace.push(`✖ Eligibility: no record for ${input.elementName} matches LE / PG1 / PG2 / PG3`);
    return { eligible:false, eligibilityRecord:null, cost:null, offset:null, traceMessages:trace };
  }
  trace.push(`✔ Eligibility: ${elCost.eligibility}`);

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

  const persElemRows = input.assignmentNumber
    ? data.personElement.filter(r => r.assignmentNumber === input.assignmentNumber &&
        r.element === input.elementName && inRange(date, r.parStartDate, r.parEndDate))
    : [];
  trace.push(persElemRows.length > 0
    ? `✔ Person-Element: ${persElemRows[0]!.assignmentNumber} (${persElemRows.length} split row${persElemRows.length > 1 ? "s" : ""})`
    : `– Person-Element: no match`);

  const personRows = input.assignmentNumber
    ? data.person.filter(r => r.assignmentNumber === input.assignmentNumber &&
        inRange(date, r.parStartDate, r.parEndDate))
    : [];
  trace.push(personRows.length > 0
    ? `✔ Person-Assignment: ${personRows[0]!.assignmentNumber} (${personRows.length} split row${personRows.length > 1 ? "s" : ""})`
    : `– Person-Assignment: no match`);

  const pos = input.positionCode
    ? data.position.find(r => r.positionCode === input.positionCode &&
        inRange(date, r.effStartDate, r.effEndDate)) ?? null
    : null;
  trace.push(pos ? `✔ Position: ${pos.positionCode} - ${pos.positionName}` : `– Position: no match`);

  const job = input.jobCode
    ? data.job.find(r => r.jobCode === input.jobCode &&
        inRange(date, r.effStartDate, r.effEndDate)) ?? null
    : null;
  trace.push(job ? `✔ Job: ${job.jobCode} - ${job.jobName}` : `– Job: no match`);

  const deptRows = data.department.filter(r =>
    r.deptName === input.department && inRange(date, r.effStartDate, r.effEndDate));
  trace.push(deptRows.length
    ? `✔ Department: ${deptRows[0]!.deptName} (${deptRows.length} split row${deptRows.length > 1 ? "s" : ""})`
    : `– Department: no match`);

  const payroll = input.payrollDefinition
    ? data.payroll.find(r => r.payrollDefinition === input.payrollDefinition &&
        inRange(date, r.effStartDate, r.effEndDate)) ?? null
    : null;
  trace.push(payroll ? `✔ Payroll: ${payroll.payrollDefinition}` : `– Payroll: no match`);

  const ffSegs   = ff ? segs(ff) : Array(9).fill(null) as (string|null)[];
  const eligSegs = segs(elCost);

  // The costing hierarchy levels shown in the ladder (first split only for display)
  const displayPersElem = persElemRows[0] ?? null;
  const displayPerson   = personRows[0] ?? null;

  const levels: HierarchyLevel[] = [
    { rank:1, name:"Fast formula override",          sub:"04 - lowest satisfied rank", sourceId: ff?.key ?? null, segments: ff ? segs(ff) : null, cls:"override" },
    { rank:2, name:"Element entry costing",           sub:"entered on the element entry", sourceId: input.elementName, segments: Array(9).fill(null), editable:true },
    { rank:3, name:"Costing for person - element",    sub:"Costing For Person-Element", sourceId: displayPersElem?.assignmentNumber ?? null, segments: displayPersElem ? segs(displayPersElem) : null },
    { rank:4, name:"Costing for person - assignment", sub:"03 - assignment costing", sourceId: displayPerson?.assignmentNumber ?? null, segments: displayPerson ? segs(displayPerson) : null },
    { rank:5, name:"Costing for position",            sub:`Costing of Position - ${pos?.positionName ?? input.positionCode ?? "-"}`, sourceId: pos?.positionCode ?? null, segments: pos ? segs(pos) : null },
    { rank:6, name:"Costing for job",                 sub:`Costing of Job - ${job?.jobName ?? input.jobCode ?? "-"}`, sourceId: job?.jobCode ?? null, segments: job ? segs(job) : null },
    { rank:7, name:"Costing for department",          sub:"02 - department costing", sourceId: deptRows[0]?.deptName ?? null, segments: deptRows[0] ? segs(deptRows[0]) : null },
    { rank:8, name:"Element eligibility costing",     sub:"01 - cost account", sourceId: elCost.eligibility, segments: eligSegs },
    { rank:9, name:"Costing for payroll",             sub:`Costing of Payroll - ${payroll?.payrollDefinition ?? input.payrollDefinition ?? "-"}`, sourceId: payroll?.payrollDefinition ?? null, segments: payroll ? segs(payroll) : null },
  ];

  // Determine which split source drives the cost lines.
  // Priority: person-element > person > position > job > department > eligibility
  let costLines: CostLine[];

  if (persElemRows.length > 0) {
    costLines = buildSplitLines(persElemRows, ffSegs, eligSegs,
      r => `Person-Element ${(r as PersonElemRow).assignmentNumber}`,
      rankMaskMap.get(3) ?? new Set());
  } else if (personRows.length > 0) {
    costLines = buildSplitLines(personRows, ffSegs, eligSegs,
      r => `Person ${(r as PersonRow).assignmentNumber}`,
      rankMaskMap.get(4) ?? new Set());
  } else if (pos) {
    costLines = buildSplitLines([pos], ffSegs, eligSegs,
      r => `Position ${(r as PositionRow).positionCode}`,
      rankMaskMap.get(5) ?? new Set());
  } else if (job) {
    costLines = buildSplitLines([job], ffSegs, eligSegs,
      r => `Job ${(r as JobRow).jobCode}`,
      rankMaskMap.get(6) ?? new Set());
  } else if (deptRows.length > 0) {
    costLines = buildSplitLines(deptRows, ffSegs, eligSegs,
      r => `Dept ${(r as DeptRow).deptName}`,
      rankMaskMap.get(7) ?? new Set());
  } else {
    // No split source — single line from FF override + eligibility
    const singleSegs = Array.from({length:9}, (_,i) =>
      !blank(ffSegs[i]) ? ffSegs[i]! : (eligSegs[i] ?? null)
    ) as (string|null)[];
    costLines = [{ percentage:100, sourceLabel:"100%", segments: singleSegs, isDefault:false }];
  }

  if (costLines.length > 1) {
    trace.push(`✔ Split costing: ${costLines.length} cost lines (${costLines.map(l => l.sourceLabel).join(", ")})`);
  }

  const elOff = matchEligibility(data.eligibility, input.elementName, "Offset Account",
    input.legalEntity, input.peopleGroup1, input.peopleGroup2, input.peopleGroup3 ?? null, date);
  const offEligSegs = elOff ? segs(elOff) : Array(9).fill(null) as (string|null)[];

  const offLevels: HierarchyLevel[] = [
    { rank:1, name:"Element eligibility costing", sub:"01 - offset account", sourceId: elOff?.eligibility ?? null, segments: elOff ? offEligSegs : null },
    { rank:2, name:"Final cost account",           sub:"the line above",      sourceId: "-",                        segments: costLines[0]!.segments },
  ];

  const offsetLines = buildOffsetLines(costLines, offEligSegs);

  // backwards-compat: expose first line's segments as top-level .segments
  const firstCostSegs  = costLines[0]!.segments;
  const firstOffSegs   = offsetLines[0]!.segments;

  return {
    eligible: true,
    eligibilityRecord: elCost.eligibility,
    cost:   { type:"Cost",   lines: costLines,  segments: firstCostSegs, levels },
    offset: { type:"Offset", lines: offsetLines, segments: firstOffSegs,  levels: offLevels },
    traceMessages: trace,
  };
}

// ── 2. computeEligibilityGrid ─────────────────────────────────────────────────

export interface EligibilityRow {
  legalEmployer: string; peopleGroup1: string; peopleGroup2: string; peopleGroup3: string|null;
  eligible: boolean; eligibilityRecord: string|null;
  segments: (string|null)[];
  accountType: string;
}

export function computeEligibilityGrid(
  combos: ComboRow[], elig: EligRow[],
  elem: string, acctType: string, date: Date
): EligibilityRow[] {
  return combos.map(c => {
    const match = matchEligibility(elig, elem, acctType, c.legalEmployer, c.peopleGroup1, c.peopleGroup2, c.peopleGroup3 ?? null, date);
    return {
      legalEmployer: c.legalEmployer, peopleGroup1: c.peopleGroup1,
      peopleGroup2: c.peopleGroup2,   peopleGroup3: c.peopleGroup3 ?? null,
      eligible: !!match,
      eligibilityRecord: match?.eligibility ?? null,
      segments: match ? segs(match) : Array(9).fill(null),
      accountType: acctType,
    };
  });
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

    const elRow    = matchEligibility(data.eligibility, elem, "Cost Account",   c.legalEmployer, c.peopleGroup1, c.peopleGroup2, c.peopleGroup3 ?? null, date);
    const elOffRow = matchEligibility(data.eligibility, elem, "Offset Account", c.legalEmployer, c.peopleGroup1, c.peopleGroup2, c.peopleGroup3 ?? null, date);

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

    const ffSegs   = ffRow    ? segs(ffRow)    : Array(9).fill(null);
    const realPersSegs = personRow ? segs(personRow) : Array(9).fill(null);
    const realDeptSegs = deptRow   ? segs(deptRow)   : Array(9).fill(null);
    const persSegs: (string|null)[] = realPersSegs.some(v => v !== null)
      ? realPersSegs
      : (includePers ? PERS_PLACEHOLDER : Array(9).fill(null));
    const deptSegs: (string|null)[] = realDeptSegs.some(v => v !== null)
      ? realDeptSegs
      : (includeDept ? DEPT_PLACEHOLDER : Array(9).fill(null));

    const cost: ResolvedSeg[] = Array.from({length:9}, (_,i) => {
      if (!elRow) return { v: null, s: "" as SegSource };
      if (!blank(ffSegs[i]))   return { v: ffSegs[i],   s: "ff"   as SegSource };
      if (!blank(persSegs[i])) return { v: persSegs[i], s: "pers" as SegSource };
      if (!blank(deptSegs[i])) return { v: deptSegs[i], s: "dept" as SegSource };
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
      deptSegments:   deptSegs,
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
