import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export const DEFAULT_SEGMENT_NAMES = [
  "Segment 1","Segment 2","Segment 3","Segment 4","Segment 5",
  "Segment 6","Segment 7","Segment 8","Segment 9",
];
export const DEFAULT_ACTIVE_RANKS = [1,2,3,4,5,6,7,8,9];

export const RANK_LABELS: Record<number, { name: string; sub: string }> = {
  1: { name: "Fast formula override",          sub: "04 - lowest satisfied rank" },
  2: { name: "Element entry costing",           sub: "entered on the element entry" },
  3: { name: "Costing for person - element",    sub: "Costing For Person-Element" },
  4: { name: "Costing for person - assignment", sub: "03 - assignment costing" },
  5: { name: "Costing for position",            sub: "Costing of Position" },
  6: { name: "Costing for job",                 sub: "Costing of Job" },
  7: { name: "Costing for department",          sub: "02 - department costing" },
  8: { name: "Element eligibility costing",     sub: "01 - cost account" },
  9: { name: "Costing for payroll",             sub: "Costing of Payroll" },
};

export interface RankMask {
  rank: number;
  excludedSegs: number[]; // 0-based segment indices that this rank must NOT contribute
}

export interface EnterpriseConfig {
  segmentNames:   string[];
  leSegmentNames: Record<string, string[]>;
  activeRanks:    number[];
  rankSegMasks:   RankMask[];
}

export function useConfig() {
  return useQuery({
    queryKey: ["costsim-config"],
    queryFn:  () => api.getConfig() as Promise<EnterpriseConfig>,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.saveConfig(body) as Promise<EnterpriseConfig>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costsim-config"] }),
  });
}

export function useSegmentNames(ia?: string): string[] {
  const { data: config } = useConfig();
  if (!config) return DEFAULT_SEGMENT_NAMES;
  if (ia && config.leSegmentNames[ia]?.length === 9) {
    return config.leSegmentNames[ia];
  }
  return config.segmentNames.length === 9 ? config.segmentNames : DEFAULT_SEGMENT_NAMES;
}

export function useActiveRanks(): Set<number> {
  const { data: config } = useConfig();
  const ranks = config?.activeRanks ?? DEFAULT_ACTIVE_RANKS;
  return new Set(ranks);
}

/**
 * Returns a Map<rank, Set<excludedSegIndex>> for use in the Visualizer ladder
 * and in any client-side display that needs to know which segments a rank skips.
 * Empty set = rank contributes all segments.
 */
export function useRankSegMasks(): Map<number, Set<number>> {
  const { data: config } = useConfig();
  const masks = config?.rankSegMasks ?? [];
  return new Map(masks.map(m => [m.rank, new Set(m.excludedSegs)]));
}
