import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SimulationInput, SimResult } from "@costsim/types";
import { SEGMENT_NAMES } from "@costsim/types";

const SEGS = SEGMENT_NAMES;

type FormState = Omit<SimulationInput, "effectiveDate"> & { effectiveDate: string };

const defaultForm: FormState = {
  elementName:"", assignmentNumber:"", legalEntity:"", department:"",
  agency:"", peopleGroup1:"", peopleGroup2:"", peopleGroup3:null,
  contractClause:null, payrollDefinition:null, jobCode:null, positionCode:null,
  effectiveDate: new Date().toISOString().slice(0,10),
};

export function VisualizerPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<SimResult | null>(null);

  const { mutate: runSim, isPending, error } = useMutation({
    mutationFn: () => api.simulate(form) as Promise<SimResult>,
    onSuccess: setResult,
  });

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value || null }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Costing Visualizer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the element and costing attributes; the simulator walks the 9-level hierarchy and shows where every segment comes from.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            ["elementName","Element name"],["assignmentNumber","Assignment number"],
            ["legalEntity","Legal entity"],["department","Department"],
            ["agency","Agency"],["peopleGroup1","People group 1"],
            ["peopleGroup2","People group 2"],["peopleGroup3","People group 3"],
            ["contractClause","Contract clause"],["payrollDefinition","Payroll definition"],
            ["jobCode","Job code"],["positionCode","Position code"],
            ["effectiveDate","Effective date"],
          ] as [keyof FormState, string][]).map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
              <input
                type={k === "effectiveDate" ? "date" : "text"}
                value={(form[k] as string) ?? ""}
                onChange={set(k)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => runSim()}
            disabled={isPending || !form.elementName || !form.legalEntity}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700"
          >
            {isPending ? "Running…" : "Run simulation"}
          </button>
          <button onClick={() => { setForm(defaultForm); setResult(null); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Reset
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{(error as Error).message}</p>}
      </div>

      {/* Result */}
      {result && (
        result.eligible ? (
          <div className="space-y-4">
            {/* Journal lines */}
            <div className="grid grid-cols-2 gap-4">
              {[result.cost, result.offset].map(line => line && (
                <div key={line.type} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    {line.type} line · {line.type === "Cost" ? "Dr" : "Cr"}
                  </div>
                  <div className="font-mono text-sm font-semibold text-gray-900">
                    {line.segments.map((v,i) => (
                      <span key={i}>{i > 0 && <span className="text-gray-300">-</span>}
                        <span className={v ? "text-gray-900" : "text-gray-300"}>{v ?? "·"}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Cost ladder */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Cost account <span className="text-xs font-normal text-gray-400 ml-2">rank 1 wins per segment</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">Source</th>
                      <th className="px-3 py-2 text-left">Identifier</th>
                      {SEGS.map(s => <th key={s} className="px-2 py-2 text-center">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.cost!.levels.map(L => (
                      <tr key={L.rank} className={L.segments ? "" : "opacity-40"}>
                        <td className="px-3 py-2 font-mono text-gray-400">{L.rank}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{L.name}</div>
                          <div className="text-gray-400">{L.sub}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">{L.sourceId ?? "—"}</td>
                        {(L.segments ?? Array(9).fill(null)).map((v, i) => {
                          const picked = v !== null && result.cost!.segments[i] === v;
                          return (
                            <td key={i} className={`px-2 py-2 text-center font-mono ${
                              picked ? "bg-green-50 text-green-700 font-semibold" : v ? "text-gray-600" : "text-gray-200"
                            }`}>
                              {v ?? "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Final row */}
                    <tr className="bg-gray-900 text-white">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-semibold uppercase text-xs tracking-wide">Final cost account</td>
                      <td className="px-3 py-2" />
                      {result.cost!.segments.map((v, i) => (
                        <td key={i} className={`px-2 py-2 text-center font-mono font-semibold ${v ? "text-white" : "text-gray-600"}`}>{v ?? "·"}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trace */}
            <details className="bg-white border border-gray-200 rounded-xl">
              <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer">Resolution trace</summary>
              <div className="px-4 pb-4 font-mono text-xs text-gray-600 space-y-1 whitespace-pre-wrap">
                {result.traceMessages.map((m,i) => <div key={i}>{m}</div>)}
              </div>
            </details>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <strong>Not eligible.</strong> {result.traceMessages[0]}
          </div>
        )
      )}
    </div>
  );
}
