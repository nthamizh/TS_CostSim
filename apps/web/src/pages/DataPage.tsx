import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const AUDIT_COLS       = ["createdAt","createdBy","updatedAt","updatedBy"];
const SYSTEM_COLS      = ["id","enterpriseId"];
const DEPT_DEFAULT_COA = ["dSeg1","dSeg2","dSeg3","dSeg4","dSeg5","dSeg6","dSeg7","dSeg8","dSeg9"];
// Cols that should never appear in the modal form
const FORM_SKIP        = new Set([...AUDIT_COLS, ...SYSTEM_COLS]);

// Static column list per table — used when the table is empty so the Add
// row form always has fields regardless of whether any rows exist yet.
// Order matches the schema definition; system + audit cols are excluded here
// (RowForm already skips them via FORM_SKIP) but included for grid display.
const TABLE_COLS: Record<string, string[]> = {
  eligibility:       ["ldg","elementName","eligibility","costingSubType","costingType","subTypeSequence","percentage","eligibilityStartDate","eligibilityEndDate","legalEmployer","peopleGroup1","peopleGroup2","peopleGroup3","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  department:        ["ldg","deptName","costingType","subTypeSequence","effStartDate","effEndDate","percentage","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9","dSeg1","dSeg2","dSeg3","dSeg4","dSeg5","dSeg6","dSeg7","dSeg8","dSeg9"],
  person:            ["ldg","personNumber","assignmentNumber","personType","department","personAgency","legalEntity","peopleGroup","costingType","subTypeSequence","percentage","parStartDate","parEndDate","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  person_element:    ["ldg","personNumber","assignmentNumber","element","personType","department","personAgency","legalEntity","peopleGroup","costingType","subTypeSequence","percentage","parStartDate","parEndDate","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  position:          ["ldg","positionCode","positionName","subTypeSequence","effStartDate","effEndDate","percentage","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  job:               ["ldg","jobCode","jobName","subTypeSequence","effStartDate","effEndDate","percentage","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  payroll:           ["ldg","payrollDefinition","costingType","subTypeSequence","effStartDate","effEndDate","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  fast_formula:      ["key","element","priorityRank","legalEntity","peopleGroup1","peopleGroup2","personAgency","personType","contractClause","startDate","endDate","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  iac_ppg:           ["legalEntity","peopleGroupSegment","element","accountType","isActive","startDate","endDate","seg1","seg2","seg3","seg4","seg5","seg6","seg7","seg8","seg9"],
  iac_seg:           ["legalEntity","accountType","segment","oldValue","newValue","startDate","endDate"],
  valid_combinations:["legalEmployer","peopleGroup1","peopleGroup2","peopleGroup3"],
  list_of_values:    ["category","value","sortOrder"],
};

const LABEL_MAP: Record<string, string> = {
  id:"ID", enterpriseId:"Enterprise",
  createdAt:"Created at", createdBy:"Created by",
  updatedAt:"Updated at", updatedBy:"Updated by",
  elementName:"Element", eligibility:"Eligibility",
  accountType:"Account type",   // IAC tables still use this
  costingSubType:"Costing sub-type", costingType:"Costing type",
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

const DATE_COLS = new Set([
  "createdAt","updatedAt","eligibilityStartDate","eligibilityEndDate",
  "effStartDate","effEndDate","parStartDate","parEndDate","startDate","endDate",
]);

// Fields that should render as a number input in the form
const NUM_COLS  = new Set(["percentage","sortOrder","priorityRank"]);
// Boolean fields
const BOOL_COLS = new Set(["isActive"]);
// Enum select options for known enum columns
const ENUM_OPTS: Record<string, string[]> = {
  costingSubType: ["COST","BAL","OVERRIDE"],
  costingType:    ["Any","Costed","Fixed","Distributed"],
  accountType:    ["Cost","Offset","Both"],  // IAC tables
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

function fmtDate(v: string): string {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  } catch { return v; }
}

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

// ── Row form modal ────────────────────────────────────────────────────────────

interface RowFormProps {
  mode: "add" | "edit";
  table: string;
  columns: string[];               // all non-system, non-audit cols for this table
  initial: Record<string, unknown>; // empty for add, existing row for edit
  onClose: () => void;
  onSaved: () => void;
}

function RowForm({ mode, table, columns, initial, onClose, onSaved }: RowFormProps) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of columns) {
      const v = initial[c];
      init[c] = v == null ? "" : String(v);
    }
    return init;
  });
  const [err, setErr] = useState("");

  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "") { payload[k] = null; continue; }
        if (NUM_COLS.has(k))  { payload[k] = Number(v); continue; }
        if (BOOL_COLS.has(k)) { payload[k] = v === "true"; continue; }
        payload[k] = v;
      }
      if (mode === "add") {
        await api.insertRow(table, payload);
      } else {
        const id = String(initial.id);
        await api.updateRow(table, id, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costsim-data", table] });
      onSaved();
    },
    onError: (e: unknown) => {
      setErr(e instanceof Error ? e.message : "Save failed — please try again.");
    },
  });

  const formCols = columns.filter(c => !FORM_SKIP.has(c) && !isDCoa(c, table));
  // Split into two columns: first half left, second half right
  const half = Math.ceil(formCols.length / 2);
  const leftCols  = formCols.slice(0, half);
  const rightCols = formCols.slice(half);

  const inputClass = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";

  const renderField = (col: string) => {
    if (ENUM_OPTS[col]) {
      return (
        <select value={form[col]} onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))} className={inputClass}>
          <option value="">— select —</option>
          {ENUM_OPTS[col]!.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }
    if (BOOL_COLS.has(col)) {
      return (
        <select value={form[col]} onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))} className={inputClass}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    if (DATE_COLS.has(col)) {
      return (
        <input type="date" value={form[col]}
          onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))}
          className={inputClass} />
      );
    }
    if (NUM_COLS.has(col)) {
      return (
        <input type="number" value={form[col]}
          onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))}
          className={inputClass} />
      );
    }
    return (
      <input type="text" value={form[col]}
        onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))}
        className={inputClass}
        placeholder="Leave blank for null" />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {mode === "add" ? "Add row" : "Edit row"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {TABLES.find(t => t.key === table)?.label}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* Fields — two-column grid */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[leftCols, rightCols].map((cols, gi) => (
              <div key={gi} className="flex flex-col gap-4">
                {cols.map(col => (
                  <div key={col}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {colLabel(col)}
                      {DATE_COLS.has(col) && <span className="ml-1 text-gray-400 font-normal">(YYYY-MM-DD)</span>}
                    </label>
                    {renderField(col)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {err ? (
            <p className="text-xs text-red-600">{err}</p>
          ) : (
            <p className="text-xs text-gray-400">Leave any field blank to store null.</p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => { setErr(""); saveMutation.mutate(); }}
              disabled={saveMutation.isPending}
              className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {saveMutation.isPending ? "Saving…" : mode === "add" ? "Add row" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirm delete dialog ────────────────────────────────────────────────────

interface ConfirmDeleteProps {
  table: string;
  row: Record<string, unknown>;
  onClose: () => void;
  onDeleted: () => void;
}

function ConfirmDelete({ table, row, onClose, onDeleted }: ConfirmDeleteProps) {
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.deleteRow(table, String(row.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costsim-data", table] });
      onDeleted();
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : "Delete failed."),
  });

  // Build a short summary of the row for the confirmation message
  const keyFields = Object.entries(row)
    .filter(([k]) => !isSystem(k) && !isAudit(k))
    .slice(0, 3)
    .map(([k, v]) => `${colLabel(k)}: ${v ?? "—"}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Delete row?</h2>
          <div className="text-xs text-gray-500 space-y-0.5">
            {keyFields.map(s => <p key={s}>{s}</p>)}
          </div>
          <p className="text-xs text-red-600 mt-2">This cannot be undone.</p>
          {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {del.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main DataPage ────────────────────────────────────────────────────────────

export function DataPage() {
  const [active,      setActive]    = useState(TABLES[0]!.key);
  const [q,           setQ]         = useState("");
  const [submitted,   setSubmitted] = useState(false);
  const [showAudit,   setShowAudit]  = useState(false);
  const [showSystem,  setShowSystem] = useState(false);
  const [showDefCoa,  setShowDefCoa] = useState(false);

  // Modal state
  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit";   row: Record<string, unknown> }
    | { type: "delete"; row: Record<string, unknown> }
    | null
  >(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["costsim-data", active],
    queryFn:  () => api.getData(active) as Promise<Record<string, unknown>[]>,
    enabled:  submitted,
  });

  const switchTable = (key: string) => {
    setActive(key);
    setSubmitted(false);
    setQ("");
    setModal(null);
  };

  const filtered = (data ?? []).filter(r =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );

  const allCols     = data && data.length > 0 ? sortCols(Object.keys(data[0]!), active) : (TABLE_COLS[active] ?? []);
  const visibleCols = allCols.filter(c => {
    if (isSystem(c) && !showSystem) return false;
    if (isAudit(c)  && !showAudit)  return false;
    if (isDCoa(c, active) && !showDefCoa) return false;
    return true;
  });

  // Columns available for the form = all except SYSTEM + AUDIT
  const formCols = allCols.filter(c => !FORM_SKIP.has(c));

  const inp = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Synced Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse costing source tables. Click Load to fetch, then Add / Edit / Delete rows directly.
        </p>
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSubmitted(true)}
          disabled={isFetching}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {isFetching ? "Loading…" : submitted ? "Reload" : "Load data"}
        </button>

        {/* Add button — only shown once data is loaded */}
        {submitted && (
          <button
            onClick={() => setModal({ type: "add" })}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add row
          </button>
        )}

        <input placeholder="Filter rows…" value={q} onChange={e => setQ(e.target.value)}
          className={`${inp} w-48`} />

        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showAudit} onChange={e => setShowAudit(e.target.checked)} className="rounded" />
          <span className="text-indigo-600">Audit cols</span>
        </label>

        {active === "department" && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showDefCoa} onChange={e => setShowDefCoa(e.target.checked)} className="rounded" />
            Default COA
          </label>
        )}

        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} className="rounded" />
          System cols
        </label>

        {submitted && !isFetching && data && (
          <span className="text-xs text-gray-400 ml-1">{filtered.length} row{filtered.length !== 1 ? "s" : ""}</span>
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
                  {/* Action column header */}
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-16 sticky left-0 bg-gray-50 z-20">
                    Actions
                  </th>
                  {visibleCols.map(c => (
                    <th key={c} className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                      isAudit(c)        ? "text-indigo-400 bg-indigo-50" :
                      isDCoa(c, active) ? "text-amber-500 bg-amber-50"  :
                      "text-gray-400"
                    }`}>
                      {colLabel(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 group">
                    {/* Edit / Delete buttons */}
                    <td className="px-2 py-1 sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ type: "edit", row })}
                          title="Edit row"
                          className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M16.862 3.487a2.25 2.25 0 113.182 3.182L6.75 19.963l-4.5 1.5 1.5-4.5L16.862 3.487z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", row })}
                          title="Delete row"
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M3 7h18" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    {visibleCols.map(c => {
                      const fmt = fmtCell(c, row[c]);
                      return (
                        <td key={c} title={fmt || undefined} className={`px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate ${
                          isAudit(c)        ? "bg-indigo-50/40 text-indigo-600 text-[11px]" :
                          isDCoa(c, active) ? "bg-amber-50/40 text-amber-700 font-mono text-[11px]" :
                          fmt === ""        ? "text-gray-200 font-mono" :
                          c.startsWith("seg") ? "font-mono text-gray-700" :
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
                    <td colSpan={visibleCols.length + 1} className="px-3 py-8 text-center text-gray-400">
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
              Default COA — toggle above to show
            </span>
          )}
          <span>· = null / not set</span>
          <span>Hover cell to see full value</span>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "add" && (
        <RowForm
          mode="add"
          table={active}
          columns={formCols}
          initial={{}}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <RowForm
          mode="edit"
          table={active}
          columns={formCols}
          initial={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <ConfirmDelete
          table={active}
          row={modal.row}
          onClose={() => setModal(null)}
          onDeleted={() => setModal(null)}
        />
      )}
    </div>
  );
}
