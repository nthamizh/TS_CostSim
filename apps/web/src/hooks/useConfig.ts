import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export const DEFAULT_SEGMENT_NAMES = [
  "Segment 1","Segment 2","Segment 3","Segment 4","Segment 5",
  "Segment 6","Segment 7","Segment 8","Segment 9",
];
export const DEFAULT_ACTIVE_RANKS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];

/** The 16 costing levels. Higher number = higher priority; 13–16 are fallbacks. */
export const RANK_LABELS: Record<number, { name: string; sub: string }> = {
  1:  { name: "Costing of payroll",                sub: "PAY COST - always 100%" },
  2:  { name: "Element eligibility costing",       sub: "EL COST - always 100%" },
  3:  { name: "Costing for department",            sub: "ORG COST - split by percentage" },
  4:  { name: "Costing of job",                    sub: "JOB COST - split by percentage" },
  5:  { name: "Costing of position",               sub: "POS COST - split by percentage" },
  6:  { name: "Costing for person (PREL)",         sub: "PREL COST - split by percentage" },
  7:  { name: "Costing for person (ASG)",          sub: "ASG COST - split by percentage" },
  8:  { name: "Costing for person - element (PRET)", sub: "PRET COST - split by percentage" },
  9:  { name: "Costing for person - element (AET)",  sub: "AET COST - split by percentage" },
  10: { name: "Costing for element entry",         sub: "EE COST - always 100%" },
  11: { name: "Fast formula override",             sub: "FF COST - always 100%" },
  12: { name: "Element eligibility override",      sub: "EL OVERRIDE - split by percentage" },
  13: { name: "Payroll default",                   sub: "PAY DFLT - remainder when split < 100%" },
  14: { name: "Department default",                sub: "ORG DFLT - remainder when split < 100%" },
  15: { name: "Payroll suspense",                  sub: "PAY SUSP - fills segments still null" },
  16: { name: "Department suspense",               sub: "ORG SUSP - fills segments still null" },
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
