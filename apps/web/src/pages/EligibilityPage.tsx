import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { api } from "../lib/api";
import { SegmentCell, SegmentHeaders } from "../components/SegmentCell";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";

const SEGS = ["Agency","Operating Unit","Fund","Cost Centre","Account","Project","Donor","Interagency","Future"] as const;

export function EligibilityPage() {
  const { data: dd, isLoading: ddLoading } = useDropdowns();
  const [elem, setElem]         = useState("");
  const [acctType, setAcctType] = useState("Cost Account");
  const [filter, setFilter]     = useState("");

  const { data: rows, isFetching, error } = useQuery({
    queryKey: ["eligibility", elem, acctType],
    queryFn:  () => api.getEligibility({ elem, acctType }) as Promise<any[]>,
    enabled:  !!elem,
  });

  const filtered = rows
    ? (!filter ? rows : rows.filter((r: any) => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())))
    : [];

  const nElig = filtered.filter((r: any) => r.eligible).length;

  if (ddLoading) return <LoadingPane label="Loading costing data..." />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Eligibility Check</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every valid Legal employer x People group combination and which eligibility record it resolves to.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-500">Element</label>
        <select value={elem} onChange={e => setElem(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">Select element...</option>
          {(dd?.elements ?? []).map((v: string) => <option key={v}>{v}</option>)}
        </select>

        <label className="text-sm text-gray-500">Account type</label>
        <select value={acctType} onChange={e => setAcctType(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option>Cost Account</option>
          <option>Offset Account</option>
        </select>

        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..."
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-48" />

        {rows && (
          <span className="text-xs text-gray-500">
            {isFetching ? "Loading..." : `${nElig} of ${filtered.length} combinations eligible`}
          </span>
        )}
      </div>

      {error && <ErrorPane message={(error as Error).message} />}

      {!elem && <div className="text-sm text-gray-400 text-center py-16">Select an element to see eligibility coverage.</div>}

      {isFetching && <LoadingPane label="Resolving eligibility..." />}

      {!isFetching && elem && rows && (
        <div className="overflow-auto border border-gray-200 rounded-xl bg-white max-h-[70vh]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
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
