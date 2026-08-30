import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const TABLES = [
  { key:"eligibility",       label:"Element Eligibility Costing" },
  { key:"department",        label:"Costing for Department" },
  { key:"person",            label:"Costing for Person" },
  { key:"person_element",    label:"Costing for Person · Element" },
  { key:"position",          label:"Costing of Position" },
  { key:"job",               label:"Costing of Job" },
  { key:"payroll",           label:"Costing of Payroll" },
  { key:"fast_formula",      label:"Fast Formula Override" },
  { key:"iac_ppg",           label:"IAC · LE PPG EL Override" },
  { key:"iac_seg",           label:"IAC · LE Segment Override" },
  { key:"valid_combinations",label:"Valid Combinations" },
  { key:"list_of_values",    label:"Lists of Values" },
];

export function DataPage() {
  const [active, setActive] = useState(TABLES[0]!.key);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["costsim-data", active],
    queryFn: () => api.getData(active) as Promise<Record<string,unknown>[]>,
  });

  const filtered = (data ?? []).filter(r =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );
  const cols = filtered.length > 0 ? Object.keys(filtered[0]!) : [];

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
              active === t.key ? "border-gray-900 text-gray-900 font-medium" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <input placeholder="filter…" value={q} onChange={e => setQ(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>{cols.map(c => <th key={c} className="px-3 py-2 text-left text-gray-400 uppercase tracking-wide font-medium whitespace-nowrap">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {cols.map(c => (
                      <td key={c} className={`px-3 py-1.5 font-mono ${row[c] == null ? "text-gray-200" : "text-gray-700"}`}>
                        {row[c] == null ? "·" : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={cols.length || 1} className="px-3 py-8 text-center text-gray-400">No rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} rows</p>
    </div>
  );
}
