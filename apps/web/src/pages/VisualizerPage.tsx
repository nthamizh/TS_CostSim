import { useState, useRef } from "react";
import { SearchableSelect } from "../components/SearchableSelect";
import { useMutation } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { useSegmentNames, useActiveRanks } from "../hooks/useConfig";
import { api } from "../lib/api";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";
import type { SimResult, CostLine, LevelResult } from "@costsim/types";

// ── Date helpers (timezone-safe: pure UTC / string maths, never local midnight) ──

/** Last day of the month containing the given YYYY-MM-DD string. */
export function lastDayOfMonth(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "";
  const [y, m] = yyyyMmDd.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
const ym = (d: string) => d.slice(0, 7);
const sameMonth = (a: string, b: string) => !!a && !!b && ym(a) === ym(b);
const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ── Level definitions ─────────────────────────────────────────────────────────

type InputKey =
  | "assignment" | "department" | "position" | "job"
  | "legalEntity" | "pg1" | "pg2" | "pg3" | "agency" | "contractClause";
type Inputs = Record<InputKey, string>;
const EMPTY_INPUTS: Inputs = {
  assignment:"", department:"", position:"", job:"",
  legalEntity:"", pg1:"", pg2:"", pg3:"", agency:"", contractClause:"",
};
const INPUT_LABEL: Record<InputKey, string> = {
  assignment:"Assignment", department:"Department", position:"Position", job:"Job",
  legalEntity:"Legal employer", pg1:"PG 1", pg2:"PG 2", pg3:"PG 3",
  agency:"Agency", contractClause:"Contract clause",
};

interface LevelDef {
  level: number; label: string; badge: string; badgeCls: string;
  inputs: InputKey[]; alwaysFull: boolean;
}
// Ordered 16 -> 1 (highest priority first).
const LEVEL_DEFS: LevelDef[] = [
  { level:16, label:"Department suspense",         badge:"ORG SUSP",    badgeCls:"b-susp", inputs:["department"], alwaysFull:true  },
  { level:15, label:"Payroll suspense",            badge:"PAY SUSP",    badgeCls:"b-susp", inputs:[],             alwaysFull:true  },
  { level:14, label:"Department default",          badge:"ORG DFLT",    badgeCls:"b-dflt", inputs:["department"], alwaysFull:true  },
  { level:13, label:"Payroll default",             badge:"PAY DFLT",    badgeCls:"b-dflt", inputs:[],             alwaysFull:true  },
  { level:12, label:"Eligibility override",        badge:"EL OVERRIDE", badgeCls:"b-ovr",  inputs:[],             alwaysFull:false },
  { level:11, label:"Fast formula",                badge:"FF COST",     badgeCls:"b-ff",   inputs:["agency","contractClause"], alwaysFull:true },
  { level:10, label:"Element entry",               badge:"EE COST",     badgeCls:"b-ee",   inputs:["assignment"], alwaysFull:true  },
  { level:9,  label:"Person-element (AET)",        badge:"AET COST",    badgeCls:"b-aet",  inputs:["assignment"], alwaysFull:false },
  { level:8,  label:"Person-element (PRET)",       badge:"PRET COST",   badgeCls:"b-pret", inputs:["assignment"], alwaysFull:false },
  { level:7,  label:"Person (ASG)",                badge:"ASG COST",    badgeCls:"b-asg",  inputs:["assignment"], alwaysFull:false },
  { level:6,  label:"Person (PREL)",               badge:"PREL COST",   badgeCls:"b-prel", inputs:["assignment"], alwaysFull:false },
  { level:5,  label:"Position",                    badge:"POS COST",    badgeCls:"b-pos",  inputs:["position"],   alwaysFull:false },
  { level:4,  label:"Job",                         badge:"JOB COST",    badgeCls:"b-job",  inputs:["job"],        alwaysFull:false },
  { level:3,  label:"Department",                  badge:"ORG COST",    badgeCls:"b-org",  inputs:["department"], alwaysFull:false },
  { level:2,  label:"Eligibility",                 badge:"EL COST",     badgeCls:"b-el",   inputs:["legalEntity","pg1","pg2","pg3"], alwaysFull:true },
  { level:1,  label:"Payroll",                     badge:"PAY COST",    badgeCls:"b-pay",  inputs:[],             alwaysFull:true  },
];
const ALL_LEVELS = LEVEL_DEFS.map(d => d.level);

// ── Styles ────────────────────────────────────────────────────────────────────

const SEL = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white";
const LBL = "block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1";
const INP_SM = "border border-gray-200 rounded px-2 py-1 text-xs bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400";

const BADGE: Record<string, string> = {
  "b-org":"bg-[#EEEDFE] text-[#3C3489]", "b-pay":"bg-[#E1F5EE] text-[#085041]",
  "b-el":"bg-[#E6F1FB] text-[#0C447C]",  "b-ff":"bg-[#FAEEDA] text-[#633806]",
  "b-ee":"bg-[#FAEEDA] text-[#633806]",  "b-asg":"bg-[#EAF3DE] text-[#27500A]",
  "b-prel":"bg-[#EAF3DE] text-[#27500A]","b-aet":"bg-[#EAF3DE] text-[#27500A]",
  "b-pret":"bg-[#EAF3DE] text-[#27500A]","b-pos":"bg-[#FAECE7] text-[#712B13]",
  "b-job":"bg-[#FAECE7] text-[#712B13]", "b-susp":"bg-[#FCEBEB] text-[#A32D2D]",
  "b-dflt":"bg-[#FAEEDA] text-[#854F0B]","b-ovr":"bg-[#EEEDFE] text-[#534AB7]",
  "b-bal":"bg-[#EAF3DE] text-[#085041]",
};

// ── Segment grid pieces ───────────────────────────────────────────────────────

const SegHdr = ({ segs }: { segs: string[] }) => (
  <div className="grid grid-cols-9 border-b border-gray-100 bg-gray-50">
    {segs.map((s, i) => (
      <div key={i} className="text-center py-1 px-1 border-r border-gray-100 last:border-r-0">
        <div className="text-[9px] text-gray-400 uppercase tracking-wide truncate">{s}</div>
        <div className="text-[9px] text-gray-300">S{i + 1}</div>
      </div>
    ))}
  </div>
);

function SegRow({ cells, pct, used, editable, onEdit, onCommit, tag }: {
  cells: (string | null)[]; pct?: number; used?: boolean[];
  editable?: boolean; onEdit?: (i: number, v: string) => void; onCommit?: () => void;
  tag?: (string | number | null)[];
}) {
  return (
    <div className="flex border-t border-gray-100">
      {pct !== undefined && (
        <div className="w-11 flex-shrink-0 flex items-center justify-center bg-amber-50 border-r border-amber-200 text-[10px] font-semibold text-amber-700 px-1">
          {pct}%
        </div>
      )}
      <div className="grid grid-cols-9 flex-1">
        {cells.map((v, i) => editable ? (
          <div key={i} className="border-r border-gray-100 last:border-r-0 p-0.5">
            <input
              value={v ?? ""}
              onChange={e => onEdit?.(i, e.target.value)}
              onBlur={onCommit}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder="·"
              className="w-full text-center font-mono text-[11px] bg-blue-50 border border-dashed border-blue-300 rounded px-0.5 py-1 focus:outline-none focus:border-blue-500"
            />
          </div>
        ) : (
          <div key={i} className={`text-center font-mono text-[11px] py-1.5 px-1 border-r border-gray-100 last:border-r-0 ${
            used?.[i] ? "bg-green-50 text-green-700 font-semibold" : v ? "text-gray-700" : "text-gray-200"
          }`}>
            <div>{v ?? "·"}</div>
            {tag && tag[i] != null && <div className="text-[9px] text-blue-500 font-normal">{tag[i]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Level card ────────────────────────────────────────────────────────────────

function LevelCard({
  def, segs, lr, isWinner, inputs, inputOptions, onInput,
  onConsider, onUserValue, userSegs, onUserSeg, onCommit, forceExpanded,
}: {
  def: LevelDef; segs: string[]; lr: LevelResult; isWinner: boolean;
  inputs: Inputs; inputOptions: (k: InputKey) => string[]; onInput: (k: InputKey, v: string) => void;
  onConsider: (v: boolean) => void; onUserValue: (v: boolean) => void;
  userSegs: (string | null)[]; onUserSeg: (i: number, v: string) => void; onCommit: () => void;
  forceExpanded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = forceExpanded || open || isWinner || lr.userValue;
  const noMatch = !lr.matched && !lr.userValue;

  return (
    <div className={`rounded-xl overflow-hidden ${isWinner ? "border-[1.5px] border-green-300" : "border border-gray-200"} ${
      !lr.considered ? "opacity-40" : noMatch ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer select-none flex-wrap" onClick={() => setOpen(o => !o)}>
        <span className="font-mono text-[11px] text-gray-400 w-5 flex-shrink-0">{def.level}</span>
        <span className={`text-[10px] font-semibold rounded px-2 py-0.5 flex-shrink-0 ${BADGE[def.badgeCls] ?? ""}`}>{def.badge}</span>
        <span className="text-xs font-medium text-gray-700 flex-shrink-0">{def.label}</span>
        {isWinner && <span className="text-[9px] font-semibold bg-green-100 text-green-700 border border-green-200 rounded px-2 py-0.5">Winner</span>}
        {noMatch && <span className="text-[10px] text-gray-400 italic">no match</span>}
        {!lr.considered && <span className="text-[10px] text-gray-400 italic">not considered</span>}

        {def.inputs.map(k => (
          <div key={k} className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-[10px] text-gray-400">{INPUT_LABEL[k]}</span>
            <SearchableSelect value={inputs[k]} onChange={v => onInput(k, v)}
              options={inputOptions(k)} placeholder="Any" className={`${INP_SM} w-32`} />
          </div>
        ))}

        <div className="ml-auto flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
            <input type="checkbox" checked={lr.considered} onChange={e => onConsider(e.target.checked)} className="rounded" />
            Consider
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-blue-600 cursor-pointer">
            <input type="checkbox" checked={lr.userValue} onChange={e => onUserValue(e.target.checked)} className="rounded accent-blue-600" />
            User value
          </label>
          <span className={`text-gray-400 text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {isOpen && (
        <div className="bg-white">
          <SegHdr segs={segs} />
          {lr.userValue ? (
            <SegRow cells={userSegs} editable onEdit={onUserSeg} onCommit={onCommit} />
          ) : lr.lines.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-gray-300 font-mono">· · · · · · · · ·</div>
          ) : lr.lines.map((cl, k) => (
            <SegRow key={k} cells={cl.segments}
              pct={lr.lines.length > 1 || (!def.alwaysFull && cl.percentage !== 100) ? cl.percentage : undefined}
              used={lr.usedMask[k]} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Final account + trace ─────────────────────────────────────────────────────

function FinalAccountCard({ label, badge, badgeCls, lines, segs }: {
  label: string; badge: string; badgeCls: string; lines: CostLine[]; segs: string[];
}) {
  const split = lines.length > 1;
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className={`text-[10px] font-semibold rounded px-2 py-0.5 ${BADGE[badgeCls] ?? ""}`}>{badge}</span>
        {split && <span className="text-[10px] text-gray-400">{lines.length} split lines</span>}
      </div>
      <SegHdr segs={segs} />
      {lines.map((cl, i) => <SegRow key={i} cells={cl.segments} pct={split ? cl.percentage : undefined} />)}
    </div>
  );
}

const srcLabel = (cl: CostLine, i: number) => {
  const lv = cl.segLevels[i], s = cl.segSources[i];
  return lv == null || !s ? null : (s === "EL BAL" ? "EL BAL" : `Level ${lv} - ${s}`);
};

function TraceSection({ lines, segs }: { lines: CostLine[]; segs: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
        Segment inheritance and traceability
      </h3>
      <div className="space-y-1">
        {segs.map((name, i) => {
          const vals = lines.map(l => l.segments[i]);
          const srcs = lines.map(l => srcLabel(l, i));
          const varies = new Set(vals).size > 1 || new Set(srcs).size > 1;
          return (
            <div key={i} className="grid grid-cols-[24px_140px_1fr] gap-2 items-start py-1 border-b border-gray-50 last:border-b-0 text-xs">
              <span className="font-mono text-gray-400 text-right text-[10px] pt-0.5">{i + 1}</span>
              <span className="text-gray-500 pt-0.5">{name}</span>
              <div className="space-y-0.5">
                {(varies ? lines : [lines[0]!]).map((l, k) => (
                  <div key={k} className="flex items-center gap-2 flex-wrap">
                    {varies && <span className="text-[10px] text-amber-600 w-9">{l.percentage}%</span>}
                    <span className="font-mono font-medium text-gray-800">{l.segments[i] ?? <span className="text-gray-300">·</span>}</span>
                    {srcLabel(l, i)
                      ? <span className="text-[10px] rounded px-1.5 py-0.5 border bg-gray-50 text-gray-600 border-gray-200">{srcLabel(l, i)}</span>
                      : <span className="text-[10px] text-red-500">unresolved</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface LevelUi { considered: boolean; userValue: boolean; userSegs: (string | null)[] }
type LevelUis = Record<number, LevelUi>;
const initLevels = (): LevelUis =>
  Object.fromEntries(ALL_LEVELS.map(l => [l, { considered: true, userValue: false, userSegs: Array(9).fill(null) }]));

export function VisualizerPage() {
  const { data: dd, isLoading, error: ddErr } = useDropdowns();
  const SEGS = useSegmentNames();
  const activeRanks = useActiveRanks();

  const today = todayLocal();
  const [ldg, setLdg] = useState("");
  const [payroll, setPayroll] = useState("");
  const [baseElement, setBaseElement] = useState("");
  const [retroElement, setRetroElement] = useState("");
  const [startDate, setStart] = useState(today);
  const [endDate, setEnd] = useState(lastDayOfMonth(today));
  const [retroStart, setRStart] = useState("");
  const [retroEnd, setREnd] = useState("");
  const [dateErr, setDateErr] = useState("");
  const [retroDateErr, setRetroErr] = useState("");

  const [forceExpanded, setForceExpanded] = useState(false);
  const [showEligOnly, setShowEligOnly] = useState(false);
  const [inputs, setInputs] = useState<Inputs>(EMPTY_INPUTS);
  const [levels, setLevels] = useState<LevelUis>(initLevels);

  const [result, setResult] = useState<SimResult | null>(null);
  const [retroResult, setRetroResult] = useState<SimResult | null>(null);

  // Always-current snapshot so blur / checkbox handlers never read stale state.
  const latest = useRef({ payroll, baseElement, retroElement, startDate, retroStart, inputs, levels });
  latest.current = { payroll, baseElement, retroElement, startDate, retroStart, inputs, levels };

  const buildPayload = (elementName: string, date: string, inp: Inputs, lv: LevelUis, pay: string) => ({
    elementName,
    assignmentNumber: inp.assignment || null,
    legalEntity: inp.legalEntity,
    department: inp.department || null,
    agency: inp.agency || null,
    peopleGroup1: inp.pg1,
    peopleGroup2: inp.pg2,
    peopleGroup3: inp.pg3 || null,
    contractClause: inp.contractClause || null,
    payrollDefinition: pay || null,
    jobCode: inp.job || null,
    positionCode: inp.position || null,
    effectiveDate: date,
    excludedLevels: ALL_LEVELS.filter(l => !lv[l]!.considered),
    userOverrides: Object.fromEntries(
      ALL_LEVELS.filter(l => lv[l]!.userValue).map(l => [String(l), lv[l]!.userSegs])),
  });

  const sim = useMutation({
    mutationFn: (body: unknown) => api.simulate(body) as Promise<SimResult>,
    onSuccess: setResult,
  });
  const retroSim = useMutation({
    mutationFn: (body: unknown) => api.simulate(body) as Promise<SimResult>,
    onSuccess: setRetroResult,
  });

  /** Run both simulations from an explicit state (so callers can pass the *next* state). */
  const runWith = (inp: Inputs, lv: LevelUis) => {
    const s = latest.current;
    if (!s.baseElement) return;
    sim.mutate(buildPayload(s.baseElement, s.startDate, inp, lv, s.payroll));
    if (s.retroElement) {
      retroSim.mutate(buildPayload(s.retroElement, s.retroStart || s.startDate, inp, lv, s.payroll));
    } else {
      setRetroResult(null);
    }
  };
  const run = () => runWith(latest.current.inputs, latest.current.levels);

  const patchLevel = (lvl: number, patch: Partial<LevelUi>, rerun: boolean) => {
    const next = { ...levels, [lvl]: { ...levels[lvl]!, ...patch } };
    setLevels(next);
    if (rerun && result) runWith(inputs, next);
  };
  const setInput = (k: InputKey, v: string) => {
    const next = { ...inputs, [k]: v };
    setInputs(next);
    if (result) runWith(next, levels);
  };

  const lov = dd?.lov ?? {};
  const pgKey = (n: number) => Object.keys(lov).find(k => k.toLowerCase().includes(`people group ${n}`)) ?? `People Group ${n}`;
  const inputOptions = (k: InputKey): string[] => {
    switch (k) {
      case "assignment": return dd?.assignments ?? [];
      case "department": return dd?.departments ?? [];
      case "position":   return dd?.positions ?? [];
      case "job":        return dd?.jobs ?? [];
      case "legalEntity":return lov["Legal Employer"] ?? [];
      case "pg1":        return lov[pgKey(1)] ?? [];
      case "pg2":        return lov[pgKey(2)] ?? [];
      case "pg3":        return lov[pgKey(3)] ?? [];
      case "agency":     return lov["Agencies"] ?? [];
      case "contractClause": return lov["Contract Clause"] ?? [];
    }
  };

  // ── Same-month date pairs ───────────────────────────────────────────────────
  const handleStart = (v: string) => { setStart(v); setDateErr(""); if (v) setEnd(lastDayOfMonth(v)); };
  const handleEnd = (v: string) => {
    if (v && startDate && !sameMonth(startDate, v)) {
      setEnd(lastDayOfMonth(startDate));
      setDateErr("End date must be in the same month as the start date. Reset to the last day of that month.");
      setTimeout(() => setDateErr(""), 4000);
    } else { setEnd(v); setDateErr(""); }
  };
  const handleRStart = (v: string) => { setRStart(v); setRetroErr(""); setREnd(v ? lastDayOfMonth(v) : ""); };
  const handleREnd = (v: string) => {
    if (v && retroStart && !sameMonth(retroStart, v)) {
      setREnd(lastDayOfMonth(retroStart));
      setRetroErr("Retro end date must be in the same month as the retro start date. Reset to the last day of that month.");
      setTimeout(() => setRetroErr(""), 4000);
    } else { setREnd(v); setRetroErr(""); }
  };

  if (isLoading) return <LoadingPane label="Loading costing data…" />;
  if (ddErr) return <ErrorPane message={(ddErr as Error).message} />;

  const costLines = result?.cost?.lines ?? [];
  const offsetLines = result?.offset?.lines ?? [];
  const byLevel = new Map((result?.levelResults ?? []).map(r => [r.level, r]));
  const visibleDefs = LEVEL_DEFS.filter(d => activeRanks.has(d.level));
  const simError = sim.error ?? retroSim.error;

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Simulation parameters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Simulation parameters</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setForceExpanded(v => !v)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              {forceExpanded ? "Collapse all" : "Expand all levels"}
            </button>
            <button onClick={() => setShowEligOnly(v => !v)}
              className={`px-3 py-1.5 text-xs border rounded-lg ${showEligOnly ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-gray-200 hover:bg-gray-50 text-gray-600"}`}>
              {showEligOnly ? "Show all levels" : "Show eligible only"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={LBL}>LDG</label>
            <SearchableSelect value={ldg} onChange={setLdg} options={lov["LDG"] ?? ["UN Legislative Data Group"]} placeholder="Select LDG…" className={SEL} /></div>
          <div><label className={LBL}>Payroll definition</label>
            <SearchableSelect value={payroll} onChange={setPayroll} options={dd?.payrolls ?? []} placeholder="Select…" className={SEL} /></div>
          <div><label className={LBL}>Base element</label>
            <SearchableSelect value={baseElement} onChange={setBaseElement} options={dd?.elements ?? []} placeholder="Select element…" className={SEL} /></div>
          <div><label className={LBL}>Retro element</label>
            <SearchableSelect value={retroElement} onChange={setRetroElement}
              options={((dd?.elements ?? []) as string[]).filter((e: string) => e.includes(" Retro"))} placeholder="None" className={SEL} /></div>

          <div><label className={LBL}>Start date</label>
            <input type="date" value={startDate} onChange={e => handleStart(e.target.value)} className={SEL} /></div>
          <div><label className={LBL}>End date <span className="text-gray-300 font-normal normal-case">same month</span></label>
            <input type="date" value={endDate}
              min={startDate ? `${ym(startDate)}-01` : undefined} max={startDate ? lastDayOfMonth(startDate) : undefined}
              onChange={e => handleEnd(e.target.value)} className={SEL} /></div>
          <div><label className={LBL}>Retro start date</label>
            <input type="date" value={retroStart} onChange={e => handleRStart(e.target.value)} className={SEL} /></div>
          <div><label className={LBL}>Retro end date <span className="text-gray-300 font-normal normal-case">same month</span></label>
            <input type="date" value={retroEnd}
              min={retroStart ? `${ym(retroStart)}-01` : undefined} max={retroStart ? lastDayOfMonth(retroStart) : undefined}
              onChange={e => handleREnd(e.target.value)} className={SEL} /></div>
        </div>

        {dateErr && <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">{dateErr}</p>}
        {retroDateErr && <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">{retroDateErr}</p>}

        <div className="mt-3 flex gap-2 items-center">
          <button onClick={run} disabled={sim.isPending || !baseElement}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700">
            {sim.isPending ? "Running…" : "Run simulation"}
          </button>
          <button onClick={() => {
              setBaseElement(""); setRetroElement(""); setPayroll(""); setLdg("");
              setInputs(EMPTY_INPUTS); setLevels(initLevels()); setResult(null); setRetroResult(null);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Reset</button>
          {simError && <span className="text-xs text-red-600">{simError instanceof Error ? simError.message : "Simulation failed"}</span>}
        </div>
      </div>

      {result && !result.eligible && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <strong>Not eligible.</strong> {result.traceMessages[0]}
          <div className="text-xs mt-1 text-red-600">Set Legal employer and people groups on the Eligibility level if the record is specific to them.</div>
        </div>
      )}
      {result?.isRetro && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <strong>Retro element.</strong> Levels 12 to 16 (override, default, suspense) do not apply.
        </div>
      )}

      {result?.eligible && result.cost && (<>
        {/* 2. Final cost and balance, with splits */}
        <div className="grid grid-cols-2 gap-4">
          <FinalAccountCard label="Final cost account" badge="Dr" badgeCls="b-asg" lines={costLines} segs={SEGS} />
          <FinalAccountCard label="Final balance account" badge="Cr" badgeCls="b-bal" lines={offsetLines} segs={SEGS} />
        </div>

        {retroResult?.eligible && retroResult.cost && (
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Retro element: {retroElement}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <FinalAccountCard label="Retro cost account" badge="Dr" badgeCls="b-asg" lines={retroResult.cost.lines} segs={SEGS} />
              <FinalAccountCard label="Retro balance account" badge="Cr" badgeCls="b-bal" lines={retroResult.offset?.lines ?? []} segs={SEGS} />
            </div>
          </div>
        )}

        {/* 3. Hierarchy cards — only levels active in Setup */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Costing hierarchy: cost account resolution</h2>
            <span className="text-[10px] text-gray-400">{visibleDefs.length} active levels · highest level wins per segment · green = value used</span>
          </div>
          <div className="space-y-2">
            {visibleDefs.map(def => {
              const lr = byLevel.get(def.level);
              if (!lr) return null;
              if (showEligOnly && !lr.matched && !lr.userValue) return null;
              const ui = levels[def.level]!;
              return (
                <LevelCard key={def.level} def={def} segs={SEGS}
                  lr={{ ...lr, considered: ui.considered && lr.considered, userValue: ui.userValue }}
                  isWinner={def.level === result.winnerLevel}
                  inputs={inputs} inputOptions={inputOptions} onInput={setInput}
                  onConsider={v => patchLevel(def.level, { considered: v }, true)}
                  onUserValue={v => patchLevel(def.level, {
                    userValue: v,
                    userSegs: v ? (ui.userSegs.some(Boolean) ? ui.userSegs : [...(lr.lines[0]?.segments ?? Array(9).fill(null))]) : ui.userSegs,
                  }, true)}
                  userSegs={ui.userSegs}
                  onUserSeg={(i, v) => {
                    const segs = [...ui.userSegs]; segs[i] = v || null;
                    setLevels(prev => ({ ...prev, [def.level]: { ...prev[def.level]!, userSegs: segs } }));
                  }}
                  onCommit={run}
                  forceExpanded={forceExpanded} />
              );
            })}
          </div>
        </div>

        {/* 4. Final resolved: each segment with the level that supplied it */}
        <div className="rounded-xl overflow-hidden border-2 border-gray-900">
          <div className="bg-gray-900 text-white px-4 py-2 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide">Final cost account</span>
            <span className="text-[10px] text-gray-400">segment value · level it came from</span>
          </div>
          <div className="bg-white">
            <SegHdr segs={SEGS} />
            {costLines.map((cl, i) => (
              <SegRow key={i} cells={cl.segments} pct={costLines.length > 1 ? cl.percentage : undefined}
                tag={cl.segLevels.map(l => (l == null ? null : `Lvl ${l}`))} />
            ))}
          </div>
        </div>

        {/* 5. Segment-dimension trace */}
        <TraceSection lines={costLines} segs={SEGS} />

        <details className="bg-white border border-gray-200 rounded-xl">
          <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer select-none">Resolution log</summary>
          <div className="px-4 pb-4 font-mono text-xs space-y-1">
            {result.traceMessages.map((m, i) => (
              <div key={i} className={m.startsWith("✔") ? "text-green-700" : m.startsWith("⚠") || m.startsWith("✖") ? "text-red-700" : "text-gray-500"}>{m}</div>
            ))}
          </div>
        </details>
      </>)}
    </div>
  );
}
