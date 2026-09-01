import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { api } from "../lib/api";
import { SegmentCell, SegmentHeaders } from "../components/SegmentCell";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";
import { exportCsv, flattenSegments } from "../lib/exportCsv";

const SEGS = ["Agency","Operating Unit","Fund","Cost Centre","Account","Project","Donor","Interagency","Future"] as const;

// Placeholder segment labels for the dept/person costing layer columns.
// When no real data exists for a combination those ranks show these labels
// so the consultant can see which segments WOULD be populated at that rank.
const DEPT_SEG_LABELS  = SEGS.map(s => `Dept ${s}`);
const PERS_SEG_LABELS  = SEGS.map(s => `Pers ${s}`);

const LEGEND = [
  { s: "ff",   label: "Fast formula override",   cls: "bg-amber-50 border-amber-300" },
  { s: "pers", label: "Person costing (SCA)",     cls: "bg-blue-50 border-blue-300" },
  { s: "dept", label: "Department costing",       cls: "bg-purple-50 border-purple-300" },
  { s: "elig", label: "Element eligibility",      cls: "bg-green-50 border-green-300" },
  { s: "cost", label: "Final cost (offset only)", cls: "bg-gray-100 border-gray-300" },
];

const selC = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400";
const lbl  = "text-[10px] font-semibold text-gray-400 uppercase tracking-wider";

export function CombinationsPage() {
  const { data: dd, isLoading: ddLoading } = useDropdowns();

  // Server-side filters
  const [elem,      setElem]    = useState("");
  const [agency,    setAgency]  = useState("");
  const [cc,        setCc]      = useState("");
  const [costType,  setCType]   = useState("Both");
  const [leFilter,  setLE]      = useState("");
  const [pg1Filter, setPG1]     = useState("");
  const [pg2Filter, setPG2]     = useState("");
  const [eligOnly,  setEO]      = useState(false);

  // Client-side display options
  const [showDept,  setShowDept] = useState(false);
  const [showPers,  setShowPers] = useState(false);
  const [filter,    setFilter]   = useState("");

  const lov    = dd?.lov ?? {};
  const pg1Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 1")) ?? "People Group 1";
  const pg2Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 2")) ?? "People Group 2";

  const qParams = {
    elem, agency: agency||"", cc: cc||"",
    leFilter: leFilter||"", pg1Filter: pg1Filter||"", pg2Filter: pg2Filter||"",
    costType, eligOnly: eligOnly ? "true" : "",
  };

  const { data: rows, isFetching, error } = useQuery({
    queryKey: ["combinations", qParams],
    queryFn:  () => api.getCombinations(qParams) as Promise<any[]>,
    enabled:  !!elem,
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r: any) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, filter]);

  const nElig  = useMemo(() => rows ? new Set(rows.filter((r: any) => r.eligible).map((r: any) => `${r.legalEmployer}|${r.peopleGroup1}|${r.peopleGroup2}|${r.peopleGroup3}`)).size : 0, [rows]);
  const nCombo = useMemo(() => rows ? new Set(rows.map((r: any) => `${r.legalEmployer}|${r.peopleGroup1}|${r.peopleGroup2}|${r.peopleGroup3}`)).size : 0, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    const flat = filtered.map((r: any) => {
      const base: Record<string, unknown> = {
        "Element":        elem,
        "Legal Employer": r.legalEmployer,
        "People Group 1": r.peopleGroup1,
        "People Group 2": r.peopleGroup2,
        "People Group 3": r.peopleGroup3 ?? "",
        "Eligible":       r.eligible ? "Yes" : "No",
        "Cost Type":      r.type,
        "FF Rule":        r.ffRule ?? "",
        "FF Rank":        r.ffRank ?? "",
        "Person Match":   r.personMatch ?? "",
        "Dept Match":     r.deptMatch ?? "",
      };
      // Final resolved segments
      const segsFlat = flattenSegments(r);
      // Dept layer columns if visible
      if (showDept) {
        DEPT_SEG_LABELS.forEach((lbl, i) => {
          base[lbl] = (r.deptSegments as (string|null)[]|null)?.[i] ?? "";
        });
      }
      // Person layer columns if visible
      if (showPers) {
        PERS_SEG_LABELS.forEach((lbl, i) => {
          base[lbl] = (r.personSegments as (string|null)[]|null)?.[i] ?? "";
        });
      }
      return { ...base, ...segsFlat };
    });
    exportCsv(`combinations_${elem}_${new Date().toISOString().slice(0,10)}.csv`, flat);
  };

  if (ddLoading) return <LoadingPane label="Loading costing data..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Costing Combinations</h1>
          <p className="text-sm text-gray-500 mt-1">All valid combinations resolved through the costing hierarchy.</p>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-1">
          <label className={lbl}>Element</label>
          <select value={elem} onChange={e => setElem(e.target.value)} className={selC}>
            <option value="">Select...</option>
            {(dd?.elements ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={lbl}>Cost type</label>
          <select value={costType} onChange={e => setCType(e.target.value)} className={selC}>
            <option>Both</option><option>Cost</option><option>Offset</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={lbl}>Legal employer</label>
          <select value={leFilter} onChange={e => setLE(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov["Legal Employer"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={lbl}>People group 1</label>
          <select value={pg1Filter} onChange={e => setPG1(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg1Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={lbl}>People group 2</label>
          <select value={pg2Filter} onChange={e => setPG2(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov[pg2Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={lbl}>Agency</label>
          <select value={agency} onChange={e => setAgency(e.target.value)} className={selC}>
            <option value="">All</option>
            {(lov["Agencies"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={lbl}>Contract clause</label>
          <select value={cc} onChange={e => setCc(e.target.value)} className={selC}>
            <option value="">None</option>
            {(lov["Contract Clause"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
          </select>
        </div>

        {/* Layer visibility checkboxes */}
        <div className="flex flex-col gap-2 justify-end pb-0.5">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={eligOnly} onChange={e => setEO(e.target.checked)} className="rounded" />
            Eligible only
          </label>
          <label className="flex items-center gap-2 text-sm text-purple-700 cursor-pointer">
            <input type="checkbox" checked={showDept} onChange={e => setShowDept(e.target.checked)}
              className="rounded accent-purple-600" />
            Department costing
          </label>
          <label className="flex items-center gap-2 text-sm text-blue-700 cursor-pointer">
            <input type="checkbox" checked={showPers} onChange={e => setShowPers(e.target.checked)}
              className="rounded accent-blue-600" />
            Person costing
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
            {isFetching ? "Resolving..." : `${filtered.length} rows - ${nElig} of ${nCombo} combinations eligible`}
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
                {/* Fixed columns */}
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Legal employer</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 1</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 2</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">PG 3</th>
                <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide">Eligible</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">FF rule</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Person / Dept</th>

                {/* Department costing layer columns */}
                {showDept && (
                  <>
                    <th className="px-2 py-1 border-l-2 border-purple-200 bg-purple-50 text-center text-[10px] font-semibold text-purple-600 uppercase tracking-wide whitespace-nowrap" colSpan={9}>
                      Department costing layer
                    </th>
                  </>
                )}

                {/* Person costing layer columns */}
                {showPers && (
                  <>
                    <th className="px-2 py-1 border-l-2 border-blue-200 bg-blue-50 text-center text-[10px] font-semibold text-blue-600 uppercase tracking-wide whitespace-nowrap" colSpan={9}>
                      Person costing layer
                    </th>
                  </>
                )}

                {/* Final resolved segments */}
                <SegmentHeaders segs={SEGS} firstBorder />
              </tr>

              {/* Second header row — segment names for expanded layers */}
              {(showDept || showPers) && (
                <tr>
                  {/* Spacer for fixed columns */}
                  <th colSpan={8} className="bg-gray-50" />

                  {showDept && DEPT_SEG_LABELS.map((s, i) => (
                    <th key={s} className={`px-2 py-1 text-center text-[9px] font-medium text-purple-500 bg-purple-50 whitespace-nowrap ${i === 0 ? "border-l-2 border-purple-200" : ""}`}>
                      {s}
                    </th>
                  ))}

                  {showPers && PERS_SEG_LABELS.map((s, i) => (
                    <th key={s} className={`px-2 py-1 text-center text-[9px] font-medium text-blue-500 bg-blue-50 whitespace-nowrap ${i === 0 ? "border-l-2 border-blue-200" : ""}`}>
                      {s}
                    </th>
                  ))}

                  {SEGS.map((s, i) => (
                    <th key={s} className={`px-2 py-1 text-center text-[9px] font-medium text-gray-400 bg-gray-50 whitespace-nowrap ${i === 0 ? "border-l-2 border-gray-200" : ""}`}>
                      {s}
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filtered.map((r: any, idx: number) => {
                const deptSegs: (string|null)[] = r.deptSegments ?? Array(9).fill(null);
                const persSegs: (string|null)[] = r.personSegments ?? Array(9).fill(null);

                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    {/* Fixed columns */}
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

                    {/* Department costing layer */}
                    {showDept && deptSegs.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-center font-mono text-[11px] ${i === 0 ? "border-l-2 border-purple-200" : ""} ${v ? "bg-purple-50 text-purple-700" : "text-gray-200"}`}>
                        {v ?? "·"}
                      </td>
                    ))}

                    {/* Person costing layer */}
                    {showPers && persSegs.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-center font-mono text-[11px] ${i === 0 ? "border-l-2 border-blue-200" : ""} ${v ? "bg-blue-50 text-blue-700" : "text-gray-200"}`}>
                        {v ?? "·"}
                      </td>
                    ))}

                    {/* Final resolved segments */}
                    {(r.segments as {v:string|null;s:string}[]).map((f, i) => (
                      <SegmentCell key={i} v={f.v} s={f.s} isFirst={i === 0} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
