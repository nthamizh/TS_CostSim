import { test } from "node:test";
import assert from "node:assert/strict";
import { runSimulation, type DataSources } from "./engine.js";
import type { SimulationInput } from "@costsim/types";

// ── fixtures ────────────────────────────────────────────────────────────────
const NULLS = { seg1:null,seg2:null,seg3:null,seg4:null,seg5:null,seg6:null,seg7:null,seg8:null,seg9:null };
const D0 = "1951-01-01", D1 = "4712-12-31";
const segsOf = (...v: (string|null)[]) =>
  Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`seg${i+1}`, v[i] ?? null]));

const elig = (sub: string, v: (string|null)[], o: object = {}) => ({
  id: "e"+Math.random(), eligibility: "EL_"+sub, elementName: "E1", costingSubType: sub, costableType: null,
  ldg: null, subTypeSequence: null, percentage: null, eligibilityStartDate: D0, eligibilityEndDate: D1,
  legalEmployer: null, peopleGroup1: null, peopleGroup2: null, peopleGroup3: null, ...segsOf(...v), ...o,
});
const person = (type: string|null, pct: number, seq: string, v: (string|null)[], o: object = {}) => ({
  assignmentNumber: "A1", legalEntity: "LE", peopleGroup: "G", personAgency: null, personType: null,
  department: "D", costingType: type, costingSubType: "COST", subTypeSequence: seq, percentage: pct,
  parStartDate: D0, parEndDate: D1, ...segsOf(...v), ...o,
});
const payroll = (sub: string, v: (string|null)[]) => ({
  payrollDefinition: "P", effStartDate: D0, effEndDate: D1, costingType: "PAY", costingSubType: sub,
  subTypeSequence: null, ...segsOf(...v),
});
const dept = (sub: string, pct: number, seq: string, v: (string|null)[]) => ({
  deptName: "D", effStartDate: D0, effEndDate: D1, costingType: "ORG", costingSubType: sub,
  subTypeSequence: seq, percentage: pct, ...segsOf(...v),
});

const data = (o: Partial<Record<keyof DataSources, unknown[]>> = {}): DataSources => ({
  eligibility: [], department: [], person: [], personElement: [], elementEntry: [], position: [], job: [],
  payroll: [], fastFormula: [], iacPpg: [], iacSeg: [], ...o,
} as unknown as DataSources);

const input = (o: Partial<SimulationInput> = {}): SimulationInput => ({
  elementName: "E1", assignmentNumber: "A1", legalEntity: "LE", department: null, agency: null,
  peopleGroup1: "", peopleGroup2: "", peopleGroup3: null, contractClause: null,
  payrollDefinition: "P", jobCode: null, positionCode: null, effectiveDate: "2025-06-01", ...o,
});
const flat = (l: { segments: (string|null)[] }) => l.segments.map(s => s ?? "·").join("-");
const total = (ls: { percentage: number }[]) => ls.reduce((s, l) => s + l.percentage, 0);

// ── tests ───────────────────────────────────────────────────────────────────

test("not eligible without an EL COST record", () => {
  const r = runSimulation(input(), data());
  assert.equal(r.eligible, false);
  assert.equal(r.cost, null);
});

test("each segment is inherited from the highest level that has it (not winner-takes-all)", () => {
  const d = data({
    eligibility: [elig("COST", [null,null,null,null,"71515"])],
    payroll: [payroll("COST", ["UNDP",null,null,null,null,null,null,"0","0"])],
    person: [person("ASG", 70, "1", [null,"DNK10",null,"B0123"]), person("ASG", 30, "2", [null,"DNK10",null,"B0999"])],
  });
  const r = runSimulation(input(), d);
  assert.deepEqual(r.cost!.lines.map(flat), ["UNDP-DNK10-·-B0123-71515-·-·-0-0", "UNDP-DNK10-·-B0999-71515-·-·-0-0"]);
  assert.equal(total(r.cost!.lines), 100);
  assert.deepEqual(r.cost!.lines[0]!.segLevels, [1,7,null,7,2,null,null,1,1]);
  assert.equal(r.winnerLevel, 7);
});

test("person rows with a blank costingType are treated as ASG (legacy data)", () => {
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", [])], person: [person(null, 100, "1", ["UNDP","ETH"])],
  }));
  assert.equal(r.cost!.lines[0]!.segments[1], "ETH");
  assert.equal(r.winnerLevel, 7);
});

test("split rows are ordered by subTypeSequence, not insertion order", () => {
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", [])],
    person: [person("ASG", 40, "2", ["B"]), person("ASG", 60, "1", ["A"])],
  }));
  assert.deepEqual(r.cost!.lines.map(l => [l.percentage, l.segments[0]]), [[60, "A"], [40, "B"]]);
});

test("PREL (6) loses to ASG (7); PRET (8) and AET (9) outrank both", () => {
  const pe = (t: string, v: string) => ({ ...person(t, 100, "1", [v]), element: "E1" });
  const d = (types: string[]) => data({
    eligibility: [elig("COST", [])],
    person: [person("PREL", 100, "1", ["prel"]), person("ASG", 100, "1", ["asg"])],
    personElement: types.map(t => pe(t, t.toLowerCase())),
  });
  assert.equal(runSimulation(input(), d([])).cost!.lines[0]!.segments[0], "asg");
  assert.equal(runSimulation(input(), d(["PRET"])).cost!.lines[0]!.segments[0], "pret");
  assert.equal(runSimulation(input(), d(["PRET","AET"])).cost!.lines[0]!.segments[0], "aet");
});

test("split below 100% gets the remainder from DFLT; total is exactly 100", () => {
  const r = runSimulation(input({ department: "D" }), data({
    eligibility: [elig("COST", [])],
    person: [person("ASG", 60, "1", ["UNDP","X"])],
    department: [dept("DFLT", 100, "1", ["UNDP","DFLT"])],
  }));
  assert.equal(total(r.cost!.lines), 100);
  const rem = r.cost!.lines[1]!;
  assert.equal(rem.percentage, 40);
  assert.equal(rem.costingSubType, "DFLT");
  assert.equal(rem.segments[1], "DFLT");
});

test("SUSP only fills null segments and never adds a line (total stays 100)", () => {
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", [null,null,null,null,"71515"])],
    payroll: [payroll("SUSP", ["S1","S2","S3","S4","S5","S6","S7","S8","S9"])],
  }));
  assert.equal(r.cost!.lines.length, 1);
  assert.equal(total(r.cost!.lines), 100);
  assert.equal(r.cost!.lines[0]!.segments[4], "71515");   // real value kept
  assert.equal(r.cost!.lines[0]!.segments[0], "S1");      // null filled
  assert.equal(r.cost!.lines[0]!.segLevels[0], 15);
});

test("dept SUSP (16) is preferred over payroll SUSP (15) segment by segment", () => {
  const r = runSimulation(input({ department: "D" }), data({
    eligibility: [elig("COST", [])],
    payroll: [payroll("SUSP", ["P1","P2"])],
    department: [dept("SUSP", 100, "1", ["D1"])],
  }));
  assert.deepEqual(r.cost!.lines[0]!.segments.slice(0, 2), ["D1", "P2"]);
});

test("retro elements skip OVERRIDE, DFLT and SUSP", () => {
  const e = (sub: string, v: (string|null)[]) => elig(sub, v, { elementName: "E1 Retro" });
  const r = runSimulation(input({ elementName: "E1 Retro", department: "D" }), data({
    eligibility: [e("COST", ["A"]), e("OVERRIDE", ["OVR"])],
    payroll: [payroll("SUSP", ["S1","S2"])],
    person: [person("ASG", 50, "1", ["A","B"])],
    department: [dept("DFLT", 100, "1", ["DF"])],
  }));
  assert.equal(r.isRetro, true);
  assert.equal(r.cost!.lines.length, 1);          // no DFLT remainder
  assert.equal(r.cost!.lines[0]!.segments[1], "B");
  assert.equal(r.cost!.lines[0]!.segments[2], null); // no SUSP fill
});

test("OVERRIDE (12) beats everything and owns the split; only the most specific rows count", () => {
  const r = runSimulation(input(), data({
    eligibility: [
      elig("COST", ["E"]),
      elig("OVERRIDE", ["O1"], { percentage: 50, subTypeSequence: "1", legalEmployer: "LE" }),
      elig("OVERRIDE", ["O2"], { percentage: 50, subTypeSequence: "2", legalEmployer: "LE" }),
      elig("OVERRIDE", ["GENERIC"], { percentage: 100, subTypeSequence: "1" }),   // less specific -> ignored
    ],
    person: [person("ASG", 100, "1", ["P"])],
  }));
  assert.deepEqual(r.cost!.lines.map(l => [l.percentage, l.segments[0]]), [[50, "O1"], [50, "O2"]]);
  assert.equal(r.winnerLevel, 12);
});

test("element entry (10) overrides person levels per segment, but does not split", () => {
  const ee = { assignmentNumber: "A1", element: "E1", costingType: "EE", costingSubType: "COST", subTypeSequence: "1",
    parStartDate: D0, parEndDate: D1, percentage: 100, ...segsOf(null, "EE2") };
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", [])], elementEntry: [ee],
    person: [person("ASG", 70, "1", ["A","a2"]), person("ASG", 30, "2", ["B","b2"])],
  }));
  assert.deepEqual(r.cost!.lines.map(flat), ["A-EE2-·-·-·-·-·-·-·", "B-EE2-·-·-·-·-·-·-·"]);
  assert.equal(r.cost!.lines[0]!.segLevels[1], 10);
});

test("fast formula (11) outranks ASG (7) per segment while ASG still splits", () => {
  const ff = { key: "FF1", element: "E1", priorityRank: 1, legalEntity: null, peopleGroup1: null, peopleGroup2: null,
    personAgency: null, personType: null, contractClause: null, startDate: D0, endDate: D1, ...segsOf(null,null,null,null,"FFACC") };
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", [null,null,null,null,"71515"])], fastFormula: [ff],
    person: [person("ASG", 50, "1", ["A"]), person("ASG", 50, "2", ["B"])],
  }));
  assert.deepEqual(r.cost!.lines.map(l => l.segments[4]), ["FFACC", "FFACC"]);
});

test("un-ticking Consider removes a level from resolution but keeps its data for display", () => {
  const d = data({ eligibility: [elig("COST", ["E"])], person: [person("ASG", 100, "1", ["P"])] });
  const on  = runSimulation(input(), d);
  const off = runSimulation(input({ excludedLevels: [7] }), d);
  assert.equal(on.cost!.lines[0]!.segments[0], "P");
  assert.equal(off.cost!.lines[0]!.segments[0], "E");
  const l7 = off.levelResults.find(l => l.level === 7)!;
  assert.equal(l7.considered, false);
  assert.equal(l7.matched, true);
});

test("User value overrides a level, even one with no data", () => {
  const d = data({ eligibility: [elig("COST", ["E"])] });
  const r = runSimulation(input({ userOverrides: { "10": ["X", null, null, null, null, null, null, null, null] } }), d);
  assert.equal(r.cost!.lines[0]!.segments[0], "X");
  assert.equal(r.levelResults.find(l => l.level === 10)!.userValue, true);
});

test("Setup segment masks make a level fall through for that segment", () => {
  const d = data({ eligibility: [elig("COST", ["E","E2"])], person: [person("ASG", 100, "1", ["P","P2"])] });
  const r = runSimulation(input(), d, [{ rank: 7, excludedSegs: [0] }]);
  assert.deepEqual(r.cost!.lines[0]!.segments.slice(0, 2), ["E", "P2"]);
});

test("levels inactive in Setup are ignored", () => {
  const d = data({ eligibility: [elig("COST", ["E"])], person: [person("ASG", 100, "1", ["P"])] });
  const r = runSimulation(input(), d, [], [1,2,3,4,5,6,8,9,10,11,12,13,14,15,16]);   // 7 off
  assert.equal(r.cost!.lines[0]!.segments[0], "E");
});

test("balance: EL BAL overrides per segment, otherwise mirrors each cost line", () => {
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", ["E","E2"]), elig("BAL", [null,"H17",null,null,"21012"])],
    person: [person("ASG", 70, "1", ["A"]), person("ASG", 30, "2", ["B"])],
  }));
  assert.deepEqual(r.offset!.lines.map(l => [l.percentage, ...l.segments.slice(0, 5)]),
    [[70, "A", "H17", null, null, "21012"], [30, "B", "H17", null, null, "21012"]]);
  assert.equal(r.offset!.lines[0]!.segSources[1], "EL BAL");
});

test("legacy rows with a null costingSubType count as COST", () => {
  const r = runSimulation(input({ department: "D" }), data({
    eligibility: [elig("COST", [])],
    department: [{ ...dept("COST", 100, "1", ["UNDP"]), costingSubType: null }],
  }));
  assert.equal(r.cost!.lines[0]!.segments[0], "UNDP");
});

test("result carries all 16 levels with a used-mask for the UI", () => {
  const r = runSimulation(input(), data({
    eligibility: [elig("COST", ["E"])], person: [person("ASG", 100, "1", ["P"])],
  }));
  assert.equal(r.levelResults.length, 16);
  const l7 = r.levelResults.find(l => l.level === 7)!;
  assert.equal(l7.usedMask[0]![0], true);
  assert.equal(r.levelResults.find(l => l.level === 2)!.usedMask[0]![0], false);
});

test("costable type comes from the eligibility record; non-Costed is flagged, legacy values count as Costed", () => {
  const run = (ct: string|null) => runSimulation(input(), data({ eligibility: [elig("COST", ["E"], { costableType: ct })] }));
  assert.equal(run("Costed").costableType, "Costed");
  assert.equal(run("EL").costableType, "Costed");       // legacy placeholder
  assert.equal(run(null).costableType, "Costed");
  const fixed = run("Fixed");
  assert.equal(fixed.costableType, "Fixed");
  assert.ok(fixed.traceMessages.some(m => m.includes('Costable type is "Fixed"')));
  assert.ok(!run("Costed").traceMessages.some(m => m.includes("Costable type")));
});
