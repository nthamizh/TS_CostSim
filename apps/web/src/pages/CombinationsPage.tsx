import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { api } from "../lib/api";
import { SegmentCell, SegmentHeaders } from "../components/SegmentCell";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";

const SEGS = ["Agency","Operating Unit","Fund","Cost Centre","Account","Project","Donor","Interagency","Future"] as const;

const LEGEND = [
  { s: "ff",   label: "Fast formula override",   cls: "bg-amber-50 border-amber-300" },
  { s: "pers", label: "Person costing (SCA)",     cls: "bg-blue-50 border-blue-300" },
  { s: "dept", label: "Department costing",       cls: "bg-purple-50 border-purple-300" },
  { s: "elig", label: "Element eligibility",      cls: "bg-green-50 border-green-300" },
  { s: "cost", label: "Final cost (offset only)", cls: "bg-gray-100 border-gray-300" },
];

export function CombinationsPage() {
  const { data: dd, isLoading: ddLoading } = useDropdowns();
  const [elem, setElem]         = useState("");
  const [atype, setAtype]       = useState("SCA agency");
  const [agency, setAgency]     = useState("");
  const [cc, setCc]             = useState("");
  const [costType, setCostType] = useState("Both");
  const [leFilter, setLeFilter] = useState("");
  const [pg1Filter, setPg1F]    = useState("");
  const [pg2Filter, setPg2F]    = useState("");
  const [eligOnly, setEligOnly] = useState(false);
  const [filter, setFilter]     = useState("");

  const lov = dd?.lov ?? {};
  const pg1Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 1")) ?? "People Group 1";
  const pg2Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 2")) ?? "People Group 2";

  const qParams = {
    elem, atype, agency: agency||"", cc: cc||"",
    leFilter: leFilter||"", pg1Filter: pg1Filter||"", pg2Filter: pg2Filter||"",
    costType, eligOnly: eligOnly ? "true" : "",
  };

  const { data: rows, isFetching, error } = useQuery({
    queryKey: ["combinations", qParams],
    queryFn:  () => api.getCombinations(qParams) as Promise<any[]>,
    enabled:  !!elem,
  });

  const filtered = rows
    ? (!filter ? rows : rows.filter((r: any) => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())))
    : [];

  const nElig  = rows ? new Set(rows.filter((r: any) => r.eligible).map((r: any) => `${r.legalEmployer}|${r.peopleGroup1}|${r.peopleGroup2}|${r.peopleGroup3}`)).size : 0;
  const nCombo = rows ? new Set(rows.map((r: any) => `${r.legalEmployer}|${r.peopleGroup1}|${r.peopleGroup2}|${r.peopleGroup3}`)).size : 0;

  const selC = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400";

  if (ddLoading) return <LoadingPane label="Loading costing data..." />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Costing Combinations</h1>
        <p className="text-sm text-gray-500 mt-1">All valid combinations resolved through the costing hierarchy.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white border border-gray-200 rounded-xl p-4">
        {[
          ["Element", <select value={elem} onChange={e => setElem(e.target.value)} className={selC}>
            <option value="">Select...</option>
            {(dd?.elements ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>],
          ["Agency type", <select value={atype} onChange={e => setAtype(e.target.value)} className={selC}>
            <option>SCA agency</option><option>Partner Agency</option><option>Regular</option>
          </select>],
          ["Cost type", <select value={costType} onChange={e => setCostType(e.target.value)} className={selC}>
            <option>Both</option><option>Cost</option><option>Offset</option>
          </select>],
          ["Legal employer", <select value={leFilter} onChange={e => setLeFilter(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov["Legal Employer"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
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

      {elem && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500">
            {isFetching ? "Resolving..." : `${filtered.length} rows - ${nElig} of ${nCombo} combinations eligible - ${atype === "SCA agency" ? "person costing applied" : "person costing skipped"}`}
          </span>
          <div className="flex gap-3 flex-wrap">
            {LEGEND.map(l => (
              <span key={l.s} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-sm border ${l.cls}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {!elem && <div className="text-sm text-gray-400 text-center py-16">Select an element to see costing combinations.</div>}
      {isFetching && <LoadingPane label="Resolving combinations..." />}

      {!isFetching && elem && rows && (
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
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">FF rule</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Person / Dept</th>
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
                  <td className="px-2 py-2 font-mono text-[11px] text-amber-700">
                    {r.ffRule ? `${r.ffRule} r${r.ffRank}` : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-gray-500">
                    {r.personMatch || r.deptMatch
                      ? <div><div className="font-mono">{r.personMatch ?? "-"}</div><div className="text-gray-400">{r.deptMatch ?? "-"}</div></div>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  {(r.segments as {v:string|null;s:string}[]).map((f, i) => (
                    <SegmentCell key={i} v={f.v} s={f.s} isFirst={i === 0} />
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
