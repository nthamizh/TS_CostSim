import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { api } from "../lib/api";
import { SegmentCell, SegmentHeaders } from "../components/SegmentCell";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";
import { exportCsv, flattenSegments } from "../lib/exportCsv";

const SEGS = ["Agency","Operating Unit","Fund","Cost Centre","Account","Project","Donor","Interagency","Future"] as const;

const selC = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400";

export function EligibilityPage() {
  const { data: dd, isLoading: ddLoading } = useDropdowns();
  const [elem,      setElem]   = useState("");
  const [leFilter,  setLE]     = useState("");
  const [pg1Filter, setPG1]    = useState("");
  const [pg2Filter, setPG2]    = useState("");
  const [pg3Filter, setPG3]    = useState("");
  const [filter,    setFilter] = useState("");

  const lov    = dd?.lov ?? {};
  const pg1Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 1")) ?? "People Group 1";
  const pg2Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 2")) ?? "People Group 2";
  const pg3Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 3")) ?? "People Group 3";

  // Fetch both account types in one call (acctType=both is the default)
  const { data: rows, isFetching, error } = useQuery({
    queryKey: ["eligibility", elem],
    queryFn:  () => api.getEligibility({ elem }) as Promise<any[]>,
    enabled:  !!elem,
  });

  // Client-side filtering: LE, PG1, PG2, PG3, text search
  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r: any) => {
      if (leFilter  && r.legalEmployer !== leFilter)  return false;
      if (pg1Filter && r.peopleGroup1  !== pg1Filter) return false;
      if (pg2Filter && r.peopleGroup2  !== pg2Filter) return false;
      if (pg3Filter && (r.peopleGroup3 ?? "") !== pg3Filter) return false;
      if (filter && !JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [rows, leFilter, pg1Filter, pg2Filter, pg3Filter, filter]);

  const nElig = useMemo(() => filtered.filter((r: any) => r.eligible).length, [filtered]);

  const handleExport = () => {
    if (!filtered.length) return;
    const flat = filtered.map((r: any) => ({
      "Element":            elem,
      "Account Type":       r.accountType,
      "Legal Employer":     r.legalEmployer,
      "People Group 1":     r.peopleGroup1,
      "People Group 2":     r.peopleGroup2,
      "People Group 3":     r.peopleGroup3 ?? "",
      "Eligible":           r.eligible ? "Yes" : "No",
      "Eligibility Record": r.eligibilityRecord ?? "",
      ...flattenSegments(r),
    }));
    exportCsv(`eligibility_${elem}_${new Date().toISOString().slice(0,10)}.csv`, flat);
  };

  if (ddLoading) return <LoadingPane label="Loading costing data..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Eligibility Check</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every valid Legal employer x People group combination and which eligibility record it resolves to.
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

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Element</label>
          <select value={elem} onChange={e => setElem(e.target.value)} className={selC}>
            <option value="">Select element...</option>
            {(dd?.elements ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Legal employer</label>
          <select value={leFilter} onChange={e => setLE(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov["Legal Employer"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">People group 1</label>
          <select value={pg1Filter} onChange={e => setPG1(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg1Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">People group 2</label>
          <select value={pg2Filter} onChange={e => setPG2(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg2Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">People group 3</label>
          <select value={pg3Filter} onChange={e => setPG3(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg3Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Search</label>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..."
            className={`${selC} w-40`} />
        </div>
        {rows && !isFetching && (
          <span className="text-xs text-gray-500 pb-1.5">
            {nElig} of {filtered.length} eligible
          </span>
        )}
      </div>

      {error && <ErrorPane message={(error as Error).message} />}
      {!elem && <div className="text-sm text-gray-400 text-center py-16">Select an element to see eligibility coverage.</div>}
      {isFetching && <LoadingPane label="Resolving eligibility..." />}

      {!isFetching && elem && rows && (
        <div className="overflow-auto border border-gray-200 rounded-xl bg-white max-h-[68vh]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Account type</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Legal employer</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 1</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 2</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 3</th>
                <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide">Eligible</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Eligibility record</th>
                <SegmentHeaders segs={SEGS} firstBorder />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-[11px]">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.accountType === "Cost Account"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-orange-50 text-orange-700"
                    }`}>{r.accountType === "Cost Account" ? "Cost" : "Offset"}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.legalEmployer}</td>
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap max-w-[180px] truncate">{r.peopleGroup1}</td>
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{r.peopleGroup2}</td>
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{r.peopleGroup3 ?? "-"}</td>
                  <td className="px-2 py-2 text-center">
                    {r.eligible
                      ? <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">yes</span>
                      : <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">no</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                    {r.eligibilityRecord ?? <span className="text-gray-300">-</span>}
                  </td>
                  {(r.segments as (string|null)[]).map((v, i) => (
                    <SegmentCell key={i} v={v} s="elig" isFirst={i === 0} />
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
