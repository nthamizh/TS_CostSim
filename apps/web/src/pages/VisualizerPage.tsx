import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDropdowns } from "../hooks/useDataAll";
import { useSegmentNames, useActiveRanks } from "../hooks/useConfig";
import { api } from "../lib/api";
import { SegmentCell, SegmentHeaders } from "../components/SegmentCell";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";
import type { SimResult, HierarchyLevel } from "@costsim/types";

type FormState = {
  elementName: string; assignmentNumber: string; legalEntity: string;
  department: string; agency: string; peopleGroup1: string; peopleGroup2: string;
  peopleGroup3: string; contractClause: string; payrollDefinition: string;
  jobCode: string; positionCode: string; effectiveDate: string;
};

const empty: FormState = {
  elementName:"", assignmentNumber:"", legalEntity:"", department:"", agency:"",
  peopleGroup1:"", peopleGroup2:"", peopleGroup3:"", contractClause:"",
  payrollDefinition:"", jobCode:"", positionCode:"",
  effectiveDate: new Date().toISOString().slice(0,10),
};

const sel = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white";
const lbl = "block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1";

export function VisualizerPage() {
  const { data: dd, isLoading, error: ddErr } = useDropdowns();
  const SEGS        = useSegmentNames();
  const activeRanks = useActiveRanks();
  const [form, setForm] = useState<FormState>(empty);
  const [result, setResult] = useState<SimResult | null>(null);
  const [entrySegs, setEntrySegs] = useState<(string|null)[]>(Array(9).fill(null));

  const lov = dd?.lov ?? {};
  const pg1Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 1")) ?? "People Group 1";
  const pg2Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 2")) ?? "People Group 2";
  const pg3Key = Object.keys(lov).find(k => k.toLowerCase().includes("people group 3")) ?? "People Group 3";

  // Validate combination against known combos (server has them, but we can't
  // re-request just for this badge — use eligibility hint instead)
  const comboValid = null; // displayed only after run

  const { mutate: runSim, isPending, error: simErr } = useMutation({
    mutationFn: () => api.simulate({
      elementName: form.elementName, assignmentNumber: form.assignmentNumber || null,
      legalEntity: form.legalEntity, department: form.department, agency: form.agency,
      peopleGroup1: form.peopleGroup1, peopleGroup2: form.peopleGroup2,
      peopleGroup3: form.peopleGroup3 || null, contractClause: form.contractClause || null,
      payrollDefinition: form.payrollDefinition || null, jobCode: form.jobCode || null,
      positionCode: form.positionCode || null, effectiveDate: form.effectiveDate,
    }) as Promise<SimResult>,
    onSuccess: setResult,
  });

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLSelectElement|HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  if (isLoading) return <LoadingPane label="Loading costing data..." />;
  if (ddErr)     return <ErrorPane message={(ddErr as Error).message} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Costing Visualizer</h1>
        <p className="text-sm text-gray-500 mt-1">Walk the 9-level costing hierarchy — every segment shows which source it came from.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={lbl}>Base element name</label>
            <select value={form.elementName} onChange={set("elementName")} className={sel}>
              <option value="">Select element...</option>
              {(dd?.elements ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Assignment number</label>
            <select value={form.assignmentNumber} onChange={set("assignmentNumber")} className={sel}>
              <option value="">None</option>
              {(dd?.assignments ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Legal entity</label>
            <select value={form.legalEntity} onChange={set("legalEntity")} className={sel}>
              <option value="">Select...</option>
              {(lov["Legal Employer"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Department</label>
            <select value={form.department} onChange={set("department")} className={sel}>
              <option value="">None</option>
              {(dd?.departments ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Agency</label>
            <select value={form.agency} onChange={set("agency")} className={sel}>
              <option value="">None</option>
              {(lov["Agencies"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>People group 1</label>
            <select value={form.peopleGroup1} onChange={set("peopleGroup1")} className={sel}>
              <option value="">Select...</option>
              {(lov[pg1Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>People group 2</label>
            <select value={form.peopleGroup2} onChange={set("peopleGroup2")} className={sel}>
              <option value="">Select...</option>
              {(lov[pg2Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>People group 3</label>
            <select value={form.peopleGroup3} onChange={set("peopleGroup3")} className={sel}>
              <option value="">None</option>
              {(lov[pg3Key] ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Contract clause</label>
            <select value={form.contractClause} onChange={set("contractClause")} className={sel}>
              <option value="">None</option>
              {(lov["Contract Clause"] ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Payroll definition</label>
            <select value={form.payrollDefinition} onChange={set("payrollDefinition")} className={sel}>
              <option value="">None</option>
              {(dd?.payrolls ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Job code</label>
            <select value={form.jobCode} onChange={set("jobCode")} className={sel}>
              <option value="">None</option>
              {(dd?.jobs ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Position code</label>
            <select value={form.positionCode} onChange={set("positionCode")} className={sel}>
              <option value="">None</option>
              {(dd?.positions ?? []).map((v: string) => <option key={v}>{v}</option>)}
            </select></div>

          <div><label className={lbl}>Effective date</label>
            <input type="date" value={form.effectiveDate} onChange={set("effectiveDate")} className={sel} /></div>
        </div>

        <div className="mt-4 flex gap-3 items-center">
          <button onClick={() => runSim()} disabled={isPending || !form.elementName || !form.legalEntity}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700">
            {isPending ? "Running..." : "Run simulation"}
          </button>
          <button onClick={() => { setForm(empty); setResult(null); }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            Reset
          </button>
        </div>
        {simErr && <p className="mt-2 text-sm text-red-600">{simErr instanceof Error ? simErr.message : JSON.stringify(simErr)}</p>}
      </div>

      {result && !result.eligible && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <strong>Not eligible.</strong> {result.traceMessages[0]}
        </div>
      )}

      {result?.eligible && result.cost && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[result.cost, result.offset].map(line => line && (
              <div key={line.type} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {line.type} line - {line.type === "Cost" ? "Dr" : "Cr"}
                </div>
                <div className="font-mono text-sm font-semibold flex flex-wrap gap-0.5">
                  {line.segments.map((v, i) => (
                    <span key={i} className="flex items-center">
                      {i > 0 && <span className="text-gray-300 mx-0.5">-</span>}
                      <span className={v ? "text-gray-900" : "text-gray-300"}>{v ?? "·"}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <LadderTable title="Cost account" sub="rank 1 wins per segment"
            levels={result.cost.levels.filter(L => activeRanks.has(L.rank))} final={result.cost.segments}
            finalLabel="Final cost account" segs={SEGS}
            entrySegs={entrySegs}
            onEntryChange={(i, v) => setEntrySegs(p => { const n = [...p]; n[i] = v||null; return n; })} />

          {result.offset && (
            <LadderTable title="Offset account" sub="eligibility offset, then final cost"
              levels={result.offset.levels.filter(L => activeRanks.has(L.rank))} final={result.offset.segments}
              finalLabel="Final offset account" segs={SEGS} />
          )}

          <details className="bg-white border border-gray-200 rounded-xl">
            <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer select-none">Resolution trace</summary>
            <div className="px-4 pb-4 font-mono text-xs space-y-1">
              {result.traceMessages.map((m, i) => (
                <div key={i} className={m.startsWith("✔") ? "text-green-700" : m.startsWith("-") ? "text-amber-700" : "text-red-700"}>{m}</div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function LadderTable({ title, sub, levels, final, finalLabel, segs, entrySegs, onEntryChange }: {
  title: string; sub: string; levels: HierarchyLevel[]; final: (string|null)[];
  finalLabel: string; segs: string[];
  entrySegs?: (string|null)[];
  onEntryChange?: (i: number, v: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-gray-400">{sub}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Rank</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Source</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Identifier</th>
              <SegmentHeaders segs={SEGS} firstBorder />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {levels.map(L => (
              <tr key={L.rank} className={L.segments ? "" : "opacity-40"}>
                <td className="px-3 py-2 font-mono text-gray-400">{L.rank}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-800">{L.name}</div>
                  <div className="text-gray-400 text-[10px]">{L.sub}</div>
                </td>
                <td className="px-3 py-2 font-mono text-gray-500 text-[11px]">{L.sourceId ?? "-"}</td>
                {L.editable && entrySegs
                  ? entrySegs.map((v, i) => (
                      <td key={i} className={`px-1 py-1 text-center ${i === 0 ? "border-l-2 border-gray-300" : ""}`}>
                        <input value={v ?? ""} onChange={e => onEntryChange?.(i, e.target.value)}
                          className="w-14 text-center font-mono text-xs border border-dashed border-gray-300 rounded px-1 py-0.5 bg-gray-50 focus:outline-none"
                          aria-label={SEGS[i]} />
                      </td>
                    ))
                  : (L.segments ?? Array(9).fill(null)).map((v: string|null, i: number) => {
                      const picked = v !== null && final[i] === v;
                      return (
                        <td key={i} className={`px-2 py-2 text-center font-mono ${i === 0 ? "border-l-2 border-gray-300" : ""} ${picked ? "bg-green-50 text-green-700 font-semibold" : v ? "text-gray-600" : "text-gray-200"}`}>
                          {v ?? "·"}
                        </td>
                      );
                    })
                }
              </tr>
            ))}
            <tr className="bg-gray-900 text-white">
              <td className="px-3 py-2" />
              <td className="px-3 py-2 font-semibold uppercase text-[10px] tracking-wide">{finalLabel}</td>
              <td className="px-3 py-2 text-gray-400 text-[10px]">segment - rank</td>
              {final.map((v, i) => (
                <td key={i} className={`px-2 py-2 text-center font-mono font-semibold ${i === 0 ? "border-l-2 border-gray-600" : ""} ${v ? "text-white" : "text-gray-600"}`}>
                  {v ?? "·"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
