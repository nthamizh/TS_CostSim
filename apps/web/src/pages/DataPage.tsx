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

// Columns to always push to the end — audit metadata
const AUDIT_COLS   = ["createdAt","createdBy","updatedAt","updatedBy"];
const SYSTEM_COLS  = ["id","enterpriseId"];

const LABEL_MAP: Record<string, string> = {
  id:"ID", enterpriseId:"Enterprise",
  createdAt:"Created", createdBy:"Created by",
  updatedAt:"Updated", updatedBy:"Updated by",
  elementName:"Element", eligibility:"Eligibility", accountType:"Account type",
  costingType:"Costing type",
  eligibilityStartDate:"Start date", eligibilityEndDate:"End date",
  legalEmployer:"Legal employer", peopleGroup1:"PG 1", peopleGroup2:"PG 2", peopleGroup3:"PG 3",
  deptName:"Department", effStartDate:"Start date", effEndDate:"End date",
  percentage:"Percentage (%)",
  dSeg1:"Default Seg1",dSeg2:"Default Seg2",dSeg3:"Default Seg3",
  dSeg4:"Default Seg4",dSeg5:"Default Seg5",dSeg6:"Default Seg6",
  dSeg7:"Default Seg7",dSeg8:"Default Seg8",dSeg9:"Default Seg9",
  personNumber:"Person #", assignmentNumber:"Assignment #",
  personType:"Person type", department:"Department", personAgency:"Agency",
  legalEntity:"Legal entity", peopleGroup:"People group",
  parStartDate:"Start date", parEndDate:"End date",
  element:"Element", positionCode:"Position code", positionName:"Position name",
  jobCode:"Job code", jobName:"Job name",
  payrollDefinition:"Payroll definition",
  key:"Key", priorityRank:"Rank",
  personType:"Person type", contractClause:"Contract clause",
  startDate:"Start date", endDate:"End date",
  peopleGroupSegment:"People group segment", isActive:"Active",
  segment:"Segment", oldValue:"Old value", newValue:"New value",
  category:"Category", value:"Value",
  sortOrder:"Sort order",
};

function colLabel(key: string): string {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  if (/^seg\d$/.test(key)) return `Seg ${key.slice(3)}`;
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
}

function sortCols(cols: string[]): string[] {
  const sys   = cols.filter(c => SYSTEM_COLS.includes(c));
  const audit = cols.filter(c => AUDIT_COLS.includes(c));
  const rest  = cols.filter(c => !SYSTEM_COLS.includes(c) && !AUDIT_COLS.includes(c));
  return [...sys, ...rest, ...audit];
}

function fmtCell(key: string, val: unknown): string {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const s = String(val);
  // Pretty-format timestamps
  if ((key === "createdAt" || key === "updatedAt") && s.includes("T")) {
    try { return new Date(s).toLocaleString(); } catch { return s; }
  }
  return s;
}

const isAudit = (key: string) => AUDIT_COLS.includes(key);
const isSystem = (key: string) => SYSTEM_COLS.includes(key);

export function DataPage() {
  const [active, setActive] = useState(TABLES[0]!.key);
  const [q, setQ]           = useState("");
  const [showSystem, setShowSystem] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["costsim-data", active],
    queryFn:  () => api.getData(active) as Promise<Record<string, unknown>[]>,
  });

  const filtered = (data ?? []).filter(r =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );

  const allCols    = filtered.length > 0 ? sortCols(Object.keys(filtered[0]!)) : [];
  const visibleCols = allCols.filter(c => showSystem || !isSystem(c));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Synced Data</h1>
        <p className="text-sm text-gray-500 mt-1">Browse all source costing tables loaded via ETL scheduler jobs.</p>
      </div>

      {/* Table tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-0">
        {TABLES.map(t => (
          <button key={t.key} onClick={() => { setActive(t.key); setQ(""); }}
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
      <div className="flex items-center gap-3">
        <input placeholder="Filter rows…" value={q} onChange={e => setQ(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} className="rounded" />
          Show system columns
        </label>
        {!isLoading && (
          <span className="text-xs text-gray-400">{filtered.length} row{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {visibleCols.map(c => (
                    <th key={c} className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                      isAudit(c) ? "text-indigo-400 bg-indigo-50" : "text-gray-400"
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
                      const val = row[c];
                      const fmt = fmtCell(c, val);
                      return (
                        <td key={c} className={`px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate ${
                          isAudit(c) ? "bg-indigo-50/40 text-indigo-600 font-mono text-[11px]" :
                          fmt === "" ? "text-gray-200 font-mono" :
                          c.startsWith("seg") || c.startsWith("dSeg") ? "font-mono text-gray-700" :
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
                    <td colSpan={visibleCols.length || 1} className="px-3 py-8 text-center text-gray-400">
                      {data?.length === 0 ? "No data loaded. Run an ETL job to populate this table." : "No rows match the filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-indigo-50 border border-indigo-200" />
          Audit columns (created/updated by ETL)
        </span>
        <span>· = null / not set</span>
      </div>
    </div>
  );
}
