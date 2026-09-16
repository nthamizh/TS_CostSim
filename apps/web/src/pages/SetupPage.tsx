import { useState, useEffect } from "react";
import { SearchableSelect } from "../components/SearchableSelect";
import {
  useConfig, useSaveConfig, RANK_LABELS,
  DEFAULT_SEGMENT_NAMES, DEFAULT_ACTIVE_RANKS,
  type RankMask,
} from "../hooks/useConfig";
import { useDropdowns }  from "../hooks/useDataAll";
import { LoadingPane, ErrorPane } from "../components/LoadingPane";

const SEG_INDEX = [0,1,2,3,4,5,6,7,8];
const RANKS     = [1,2,3,4,5,6,7,8,9];

// Ranks that support per-segment exclusion (entry costing and eligibility are fixed)
const MASKABLE_RANKS = new Set([1,3,4,5,6,7,8,9]);

export function SetupPage() {
  const { data: config, isLoading, error } = useConfig();
  const { data: dd }  = useDropdowns();
  const saveConfig    = useSaveConfig();

  const [segNames,    setSegNames]   = useState<string[]>(DEFAULT_SEGMENT_NAMES);
  const [activeRanks, setActive]     = useState<Set<number>>(new Set(DEFAULT_ACTIVE_RANKS));
  // rankMasks: Map<rank, Set<excludedSegIdx>>
  const [rankMasks,   setRankMasks]  = useState<Map<number, Set<number>>>(new Map());
  const [leSegs,      setLeSegs]     = useState<Record<string, string[]>>({});
  const [editingLE,   setEditingLE]  = useState<string>("");
  const [expandedRank, setExpanded]  = useState<number|null>(null);
  const [saved,       setSaved]      = useState(false);
  const [saveErr,     setSaveErr]    = useState("");

  const legalEmployers: string[] = (dd?.lov?.["Legal Employer"] ?? []);

  useEffect(() => {
    if (!config) return;
    setSegNames(config.segmentNames.length === 9 ? config.segmentNames : DEFAULT_SEGMENT_NAMES);
    setActive(new Set(config.activeRanks));
    setLeSegs(config.leSegmentNames ?? {});
    const maskMap = new Map<number, Set<number>>();
    for (const m of (config.rankSegMasks ?? [])) {
      maskMap.set(m.rank, new Set(m.excludedSegs));
    }
    setRankMasks(maskMap);
  }, [config]);

  const toggleRank = (rank: number) => {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(rank)) {
        if (next.size === 1) return prev;
        next.delete(rank);
        if (expandedRank === rank) setExpanded(null);
      } else {
        next.add(rank);
      }
      return next;
    });
  };

  const toggleSegExclusion = (rank: number, segIdx: number) => {
    setRankMasks(prev => {
      const next   = new Map(prev);
      const excl   = new Set(next.get(rank) ?? []);
      if (excl.has(segIdx)) excl.delete(segIdx);
      else                  excl.add(segIdx);
      if (excl.size === 0) next.delete(rank);
      else                 next.set(rank, excl);
      return next;
    });
  };

  const setLESeg = (le: string, idx: number, val: string) => {
    setLeSegs(prev => {
      const names = prev[le]?.length === 9
        ? [...prev[le]!]
        : [...(config?.segmentNames ?? DEFAULT_SEGMENT_NAMES)];
      names[idx] = val;
      return { ...prev, [le]: names };
    });
  };

  const handleSave = async () => {
    setSaved(false); setSaveErr("");
    try {
      const rankSegMasksArr: RankMask[] = [];
      for (const [rank, excl] of rankMasks) {
        if (excl.size > 0) {
          rankSegMasksArr.push({ rank, excludedSegs: [...excl].sort((a,b) => a-b) });
        }
      }
      await saveConfig.mutateAsync({
        segmentNames:   segNames,
        leSegmentNames: leSegs,
        activeRanks:    [...activeRanks].sort((a,b) => a-b),
        rankSegMasks:   rankSegMasksArr,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed");
    }
  };

  const card  = "bg-white border border-gray-200 rounded-xl p-5";
  const sTitle = "text-sm font-semibold text-gray-900 mb-1";
  const sDesc  = "text-xs text-gray-500 mb-4";
  const inp    = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

  if (isLoading) return <LoadingPane label="Loading configuration..." />;
  if (error)     return <ErrorPane message={(error as Error).message} />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Cost Simulator Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure segment names and costing hierarchy for this enterprise.
          Changes apply across Simulator, Eligibility, and Combinations pages.
        </p>
      </div>

      {/* ── Section 1: Segment names ──────────────────────────────────────── */}
      <div className={card}>
        <h2 className={sTitle}>Segment names</h2>
        <p className={sDesc}>
          Name each of the 9 GL account segments as your enterprise uses them.
          These labels appear as column headers across all pages.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {SEG_INDEX.map(i => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Segment {i + 1}
              </label>
              <input
                value={segNames[i] ?? ""}
                onChange={e => {
                  const next = [...segNames];
                  next[i] = e.target.value;
                  setSegNames(next);
                }}
                className={inp}
                placeholder={`Segment ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Hierarchy ranks + segment masks ────────────────────── */}
      <div className={card}>
        <h2 className={sTitle}>Costing hierarchy ranks</h2>
        <p className={sDesc}>
          Check the ranks your enterprise uses. Expand any active rank to exclude
          specific segments from its contribution — excluded segments fall through
          to the next rank instead of being blocked. At least one rank must stay active.
        </p>
        <div className="space-y-2">
          {RANKS.map(rank => {
            const isActive   = activeRanks.has(rank);
            const excl       = rankMasks.get(rank) ?? new Set<number>();
            const hasExcl    = excl.size > 0;
            const isExpanded = expandedRank === rank;
            const label      = RANK_LABELS[rank]!;
            const canMask    = MASKABLE_RANKS.has(rank);

            return (
              <div key={rank}
                className={`rounded-lg border transition-colors ${
                  isActive
                    ? "border-indigo-200 bg-indigo-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Rank header row */}
                <div className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleRank(rank)}
                    className="mt-0.5 rounded accent-indigo-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gray-400 w-4 flex-shrink-0">{rank}</span>
                      <span className={`text-sm font-medium ${isActive ? "text-gray-900" : "text-gray-400"}`}>
                        {label.name}
                      </span>
                      {hasExcl && isActive && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
                          {excl.size} seg{excl.size > 1 ? "s" : ""} excluded
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 ml-6">{label.sub}</p>
                  </div>

                  {/* Expand / collapse for segment mask — only when active and maskable */}
                  {isActive && canMask && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : rank)}
                      className="flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                    >
                      {isExpanded ? "▲ Hide" : "▼ Segments"}
                    </button>
                  )}
                </div>

                {/* Segment exclusion checkboxes */}
                {isExpanded && isActive && canMask && (
                  <div className="px-4 pb-3 pt-1 border-t border-indigo-100">
                    <p className="text-xs text-gray-500 mb-2">
                      Checked = this rank <strong>contributes</strong> that segment.
                      Uncheck to exclude — excluded segments fall through to the next rank.
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SEG_INDEX.map(i => {
                        const isIncluded = !excl.has(i);
                        return (
                          <label key={i}
                            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                              isIncluded
                                ? "border-indigo-200 bg-white text-gray-700"
                                : "border-dashed border-gray-300 bg-gray-50 text-gray-400"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={() => toggleSegExclusion(rank, i)}
                              className="rounded accent-indigo-600"
                            />
                            <span className={isIncluded ? "font-medium" : "line-through"}>
                              {segNames[i] ?? `Seg ${i + 1}`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Per-LE segment names (interagency) ─────────────────── */}
      <div className={card}>
        <h2 className={sTitle}>Interagency segment names (per legal employer)</h2>
        <p className={sDesc}>
          The Interagency page can show different segment names per legal employer.
          Select an LE to configure its labels. Leave blank to inherit enterprise-wide names.
        </p>
        <div className="flex gap-2 mb-4">
          <SearchableSelect
            value={editingLE}
            onChange={le => {
              setEditingLE(le);
              if (le && !leSegs[le]) {
                setLeSegs(prev => ({ ...prev, [le]: [...segNames] }));
              }
            }}
            options={legalEmployers.map(le => ({ value: le, label: le + (leSegs[le] ? " ✓" : "") }))}
            placeholder="Select legal employer to configure…"
            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {editingLE && leSegs[editingLE] && (
            <button
              onClick={() => {
                setLeSegs(prev => { const n = {...prev}; delete n[editingLE]; return n; });
                setEditingLE("");
              }}
              className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
            >
              Reset to enterprise names
            </button>
          )}
        </div>

        {editingLE && leSegs[editingLE] && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <p className="col-span-3 text-xs text-gray-500 mb-1">
              Segment names for <strong>{editingLE}</strong> on the Interagency page:
            </p>
            {SEG_INDEX.map(i => (
              <div key={i} className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Segment {i + 1}
                </label>
                <input
                  value={leSegs[editingLE]?.[i] ?? segNames[i] ?? ""}
                  onChange={e => setLESeg(editingLE, i, e.target.value)}
                  className={inp}
                  placeholder={segNames[i] ?? `Segment ${i + 1}`}
                />
              </div>
            ))}
          </div>
        )}

        {Object.keys(leSegs).length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Configured legal employers
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(leSegs).map(le => (
                <button key={le} onClick={() => setEditingLE(le)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    editingLE === le
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {le}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveConfig.isPending}
          className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saveConfig.isPending ? "Saving…" : "Save configuration"}
        </button>
        {saved   && <span className="text-sm text-emerald-600 font-medium">Saved successfully</span>}
        {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
      </div>
    </div>
  );
}
