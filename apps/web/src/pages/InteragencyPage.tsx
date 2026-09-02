import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { useSegmentNames, useActiveRanks } from "../hooks/useConfig";
import { api } from "../lib/api";
import { SegmentCell, SegmentHeaders } from "../components/SegmentCell";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";
import { exportCsv, flattenSegments } from "../lib/exportCsv";

const LEGEND = [
  { cls: "bg-teal-50 border-teal-300",  label: "LE PPG EL override (rank 1)" },
  { cls: "bg-pink-50 border-pink-300",  label: "LE segment override (rank 2)" },
  { cls: "bg-gray-50 border-gray-200",  label: "Unchanged (rank 3)" },
];

export function InteragencyPage() {
  const { data: dd, isLoading: ddLoading } = useDropdowns();
  // Segment names switch dynamically when an interagency LE is selected
  const SEGS = useSegmentNames(ia || undefined);
  const [elem, setElem]         = useState("");
  const [ia, setIa]             = useState("");
  const [atype, setAtype]       = useState("SCA agency");
  const [agency, setAgency]     = useState("");
  const [cc, setCc]             = useState("");
  const [costType, setCostType] = useState("Both");
  const [pg1Filter, setPg1F]    = useState("");
  const [pg2Filter, setPg2F]    = useState("");
  const [eligOnly, setEligOnly] = useState(true);
  const [filter, setFilter]     = useState("");

  const lov = dd?.lov ?? {};
  const pg1Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 1")) ?? "People Group 1";
  const pg2Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 2")) ?? "People Group 2";

  const qParams = {
    elem, ia, agency: agency||"", cc: cc||"",
    pg1Filter: pg1Filter||"", pg2Filter: pg2Filter||"",
    costType, eligOnly: eligOnly ? "true" : "false",
  };

  const { data: rows, isFetching, error } = useQuery({
    queryKey: ["interagency", qParams],
    queryFn:  () => api.getInteragency(qParams) as Promise<any[]>,
    enabled:  !!elem && !!ia,
  });

  const filtered = rows
    ? (!filter ? rows : rows.filter((r: any) => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())))
    : [];

  const nOv    = rows ? rows.filter((r: any) => (r.overridesApplied?.length ?? 0) > 0).length : 0;
  const nElig  = rows ? new Set(rows.filter((r: any) => r.eligible).map((r: any) => `${r.legalEmployer}|${r.peopleGroup1}|${r.peopleGroup2}`)).size : 0;
  const nCombo = rows ? new Set(rows.map((r: any) => `${r.legalEmployer}|${r.peopleGroup1}|${r.peopleGroup2}`)).size : 0;

  const selC = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400";

  const handleExport = () => {
    if (!filtered.length) return;
    const flat = filtered.map((r: any) => ({
      "Element":           elem,
      "Interagency LE":    ia,
      "Legal Employer":    r.legalEmployer,
      "People Group 1":    r.peopleGroup1,
      "People Group 2":    r.peopleGroup2,
      "People Group 3":    r.peopleGroup3 ?? "",
      "Eligible":          r.eligible ? "Yes" : "No",
      "Cost Type":         r.type,
      "Person Match":      r.personMatch ?? "",
      "Dept Match":        r.deptMatch ?? "",
      "Overrides Applied": (r.overridesApplied ?? []).join("; "),
      ...flattenSegments(r),
    }));
    exportCsv(`interagency_${elem}_${ia}_${new Date().toISOString().slice(0,10)}.csv`, flat);
  };

  if (ddLoading) return <LoadingPane label="Loading costing data..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Costing Combinations - Interagency</h1>
          <p className="text-sm text-gray-500 mt-1">
            Final accounts with LE PPG EL override (rank 1) and LE segment override (rank 2) applied.
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={handleExport}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export {filtered.length} rows
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white border border-gray-200 rounded-xl p-4">
        {[
          ["Element", <select value={elem} onChange={e => setElem(e.target.value)} className={selC}>
            <option value="">Select...</option>
            {(dd?.elements ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
          ["Interagency (filters LE)", <select value={ia} onChange={e => setIa(e.target.value)} className={selC}>
            <option value="">Select...</option>
            {(dd?.interagencyLEs ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
          ["Cost type", <select value={costType} onChange={e => setCostType(e.target.value)} className={selC}>
            <option>Both</option><option>Cost</option><option>Offset</option>
          </select>],
          ["People group 1", <select value={pg1Filter} onChange={e => setPg1F(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg1Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
          ["People group 2", <select value={pg2Filter} onChange={e => setPg2F(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg2Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
          ["Agency", <select value={agency} onChange={e => setAgency(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov["Agencies"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
          ["Contract clause", <select value={cc} onChange={e => setCc(e.target.value)} className={selC}>
            <option value="">None</option>
            {(lov["Contract Clause"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
        ].map(([label, control]) => (
          <div key={label as string} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
            {control}
          </div>
        ))}
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={eligOnly} onChange={e => setEligOnly(e.target.checked)} className="rounded" />
            Eligible only
          </label>
        </div>
        <div className="flex items-end">
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter rows..."
            className={`${selC} w-full`} />
        </div>
      </div>

      {error && <ErrorPane message={(error as Error).message} />}

      {elem && ia && !isFetching && rows && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500">
            {`${filtered.length} rows - ${nElig} of ${nCombo} ${ia} combinations eligible - overrides on ${nOv} row(s)`}
          </span>
          <div className="flex gap-3 flex-wrap">
            {LEGEND.map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-sm border ${l.cls}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {(!elem || !ia) && <div className="text-sm text-gray-400 text-center py-16">Select an element and interagency legal employer.</div>}
      {isFetching && <LoadingPane label="Applying interagency overrides..." />}

      {!isFetching && elem && ia && rows && (
        <div className="overflow-auto border border-gray-200 rounded-xl bg-white max-h-[65vh]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Legal employer</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 1</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 2</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 3</th>
                <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide">Eligible</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Person / Dept</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Overrides</th>
                <SegmentHeaders segs={SEGS} firstBorder />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">{r.legalEmployer}</td>
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap max-w-[140px] truncate">{r.peopleGroup1}</td>
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{r.peopleGroup2}</td>
                  <td className="px-2 py-2 text-gray-400">{r.peopleGroup3 ?? "-"}</td>
                  <td className="px-2 py-2 text-center">
                    {r.eligible
                      ? <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">yes</span>
                      : <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">no</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-600">{r.type}</td>
                  <td className="px-2 py-2 text-[11px] text-gray-500">
                    {r.personMatch || r.deptMatch
                      ? <div><div className="font-mono">{r.personMatch ?? "-"}</div><div className="text-gray-400">{r.deptMatch ?? "-"}</div></div>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-teal-700">
                    {r.overridesApplied?.length > 0
                      ? r.overridesApplied.join(", ")
                      : <span className="text-gray-300">-</span>}
                  </td>
                  {(r.segments as {v:string|null;s:string;old?:string|null}[]).map((f, i) => (
                    <SegmentCell key={i} v={f.v} s={f.s} old={f.old} isFirst={i === 0} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
