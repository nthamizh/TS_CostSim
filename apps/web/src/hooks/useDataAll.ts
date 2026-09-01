import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/** Dropdown data: LOV + distinct source values. Cached 5 min. */
export function useDropdowns() {
  return useQuery({
    queryKey: ["dropdowns"],
    queryFn:  () => api.getDropdowns() as Promise<any>,
    staleTime: 5 * 60 * 1000,
  });
}
