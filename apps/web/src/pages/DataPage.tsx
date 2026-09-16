import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const TABLES = [
  { key:"eligibility",        label:"Element Eligibility Costing" },
  { key:"department",         label:"Costing for Department" },
  { key:"person",             label:"Costing for Person" },
  { key:"person_element",     label:"Costing for Person · Element" },
  { key:"position",           label:"Costing of Position" },
  { key:"job",                label:"Costing of Job" },
  { key:"payroll",            label:"Costing of Payroll" },
  { key:"fast_formula",       label:"Fast Formula Override" },
  { key:"iac_ppg",            label:"IAC · LE PPG EL Override" },
  { key:"iac_seg",            label:"IAC · LE Segment Override" },
  { key:"valid_combinations", label:"Valid Combinations" },
  { key:"list_of_values",     label:"Lists of Values" },
];

// Columns always hidden unless user toggles "Show audit"
const AUDIT_COLS  = ["createdAt","createdBy","updatedAt","updatedBy"];
// Columns hidden unless user toggles "Show system"
const SYSTEM_COLS = ["id","enterpriseId"];
// Default COA columns — hidden in department table (available in engine but not needed in UI)
const DEPT_DEFAULT_COA = ["dSeg1","dSeg2","dSeg3","dSeg4","dSeg5","dSeg6","dSeg7","dSeg8","dSeg9"];

const LABEL_MAP: Record<string, string> = {
  id:"ID", enterpriseId:"Enterprise",
  createdAt:"Created at", createdBy:"Created by",
  updatedAt:"Updated at", updatedBy:"Updated by",
  elementName:"Element", eligibility:"Eligibility",
  accountType:"Account type", costingType:"Costing type",
  subTypeSequence:"Sub-type seq",
  eligibilityStartDate:"Start date", eligibilityEndDate:"End date",
  legalEmployer:"Legal employer", legalEntity:"Legal entity",
  peopleGroup1:"PG 1", peopleGroup2:"PG 2", peopleGroup3:"PG 3",
  deptName:"Department", effStartDate:"Start date", effEndDate:"End date",
  percentage:"Percentage (%)", ldg:"LDG",
  personNumber:"Person #", assignmentNumber:"Assignment #",
  personType:"Person type", department:"Department", personAgency:"Agency",
  peopleGroup:"People group",
  parStartDate:"Start date", parEndDate:"End date",
  element:"Element", positionCode:"Position code", positionName:"Position name",
  jobCode:"Job code", jobName:"Job name",
  payrollDefinition:"Payroll definition",
  key:"Key", priorityRank:"Rank",
  contractClause:"Contract clause",
  startDate:"Start date", endDate:"End date",
  peopleGroupSegment:"People group segment", isActive:"Active",
  segment:"Segment", oldValue:"Old value", newValue:"New value",
  category:"Category", value:"Value", sortOrder:"Sort order",
};

function colLabel(key: string): string {
  if (LABEL_MAP[key]) return LABEL_MAP[key]!;
  if (/^seg\d$/.test(key)) return `Seg ${key.slice(3)}`;
  if (/^dSeg\d$/.test(key)) return `Def Seg ${key.slice(4)}`;
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
}

function sortCols(cols: string[], table: string): string[] {
  const sys   = cols.filter(c => SYSTEM_COLS.includes(c));
  const audit = cols.filter(c => AUDIT_COLS.includes(c));
  const dCoa  = table === "department" ? cols.filter(c => DEPT_DEFAULT_COA.includes(c)) : [];
  const rest  = cols.filter(c =>
    !SYSTEM_COLS.includes(c) && !AUDIT_COLS.includes(c) && !DEPT_DEFAULT_COA.includes(c)
  );
  return [...sys, ...rest, ...dCoa, ...audit];
}

/** Normalise any date-like value to DD-MMM-YYYY for consistent display */
function fmtDate(v: string): string {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    }); // e.g. "01 Jan 2024"
  } catch {
    return v;
  }
}

const DATE_COLS = new Set([
  "createdAt","updatedAt","eligibilityStartDate","eligibilityEndDate",
  "effStartDate","effEndDate","parStartDate","parEndDate","startDate","endDate",
]);

function fmtCell(key: string, val: unknown): string {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const s = String(val);
  if (DATE_COLS.has(key) && s.length >= 8) return fmtDate(s);
  return s;
}

const isAudit  = (c: string) => AUDIT_COLS.includes(c);
const isSystem = (c: string) => SYSTEM_COLS.includes(c);
const isDCoa   = (c: string, table: string) => table === "department" && DEPT_DEFAULT_COA.includes(c);

export function DataPage() {
  const [active,      setActive]     = useState(TABLES[0]!.key);
  const [q,           setQ]          = useState("");
  const [submitted,   setSubmitted]  = useState(false);   // manual load trigger
  const [showAudit,   setShowAudit]  = useState(false);
  const [showSystem,  setShowSystem] = useState(false);
  const [showDefCoa,  setShowDefCoa] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["costsim-data", active],
    queryFn:  () => api.getData(active) as Promise<Record<string, unknown>[]>,
    enabled:  submitted,          // only fires after user clicks Load
  });

  // Switch table resets submission so user re-triggers load for each table
  const switchTable = (key: string) => {
    setActive(key);
    setSubmitted(false);
    setQ("");
  };

  const filtered = (data ?? []).filter(r =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );

  const allCols     = filtered.length > 0 ? sortCols(Object.keys(filtered[0]!), active) : [];
  const visibleCols = allCols.filter(c => {
    if (isSystem(c) && !showSystem) return false;
    if (isAudit(c)  && !showAudit)  return false;
    if (isDCoa(c, active) && !showDefCoa) return false;
    return true;
  });

  const inp = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Synced Data</h1>
        <p className="text-sm text-gray-500 mt-1">Browse costing source tables loaded via ETL. Select a table and click Load to fetch data.</p>
      </div>

      {/* Table tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABLES.map(t => (
          <button key={t.key} onClick={() => switchTable(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              active === t.key
                ? "border-gray-900 text-gray-900 font-medium"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Manual load */}
        <button
          onClick={() => setSubmitted(true)}
          disabled={isFetching}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {isFetching ? "Loading…" : submitted ? "Reload" : "Load data"}
        </button>

        <input placeholder="Filter rows…" value={q} onChange={e => setQ(e.target.value)}
          className={`${inp} w-52`} />

        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showAudit} onChange={e => setShowAudit(e.target.checked)} className="rounded" />
          <span className="text-indigo-600">Audit columns</span>
        </label>

        {active === "department" && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showDefCoa} onChange={e => setShowDefCoa(e.target.checked)} className="rounded" />
            Default COA cols
          </label>
        )}

        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} className="rounded" />
          System cols
        </label>

        {submitted && !isFetching && data && (
          <span className="text-xs text-gray-400">{filtered.length} row{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {!submitted ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <p className="mb-3 text-gray-500 font-medium">No data loaded</p>
            <p>Click <strong>Load data</strong> to fetch the current table.</p>
          </div>
        ) : isLoading || isFetching ? (
          <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {visibleCols.map(c => (
                    <th key={c} className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                      isAudit(c)            ? "text-indigo-400 bg-indigo-50"  :
                      isDCoa(c, active)     ? "text-amber-500 bg-amber-50"   :
                      "text-gray-400"
                    }`}>
                      {colLabel(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {visibleCols.map(c => {
                      const fmt = fmtCell(c, row[c]);
                      return (
                        <td key={c} className={`px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate ${
                          isAudit(c)            ? "bg-indigo-50/40 text-indigo-600 text-[11px]" :
                          isDCoa(c, active)     ? "bg-amber-50/40 text-amber-700 font-mono text-[11px]" :
                          fmt === ""            ? "text-gray-200 font-mono" :
                          c.startsWith("seg")  ? "font-mono text-gray-700" :
                          "text-gray-700"
                        }`}>
                          {fmt === "" ? "·" : fmt}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length || 1}
                      className="px-3 py-8 text-center text-gray-400">
                      {data?.length === 0 ? "No data loaded for this table yet." : "No rows match the filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {submitted && !isFetching && (
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-50 border border-indigo-200" />
            Audit (created/updated) — toggle above to show
          </span>
          {active === "department" && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-200" />
              Default COA segments — toggle above to show
            </span>
          )}
          <span>· = null / not set</span>
          <span>Dates shown as DD MMM YYYY</span>
        </div>
      )}
    </div>
  );
}
