/**
 * CostSimulator Module Federation remote entry.
 * Platform imports this via `import("costsim/App")`.
 */
import { Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@nthamizh/ui/styles.css";
import { initApi } from "./lib/api";
import { usePermStore } from "./stores/permStore";
import type { CostSimPermissions } from "@costsim/types";
import { VisualizerPage } from "./pages/VisualizerPage";
import { EligibilityPage } from "./pages/EligibilityPage";
import { CombinationsPage } from "./pages/CombinationsPage";
import { InteragencyPage } from "./pages/InteragencyPage";
import { DataPage } from "./pages/DataPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

interface CostSimAppProps {
  apiBaseUrl: string;
  basePath: string;
  isPlatformAdmin: boolean;
  getAccessToken: () => string | null;
  permissions?: CostSimPermissions;
}

export default function CostSimApp({
  apiBaseUrl, basePath, isPlatformAdmin, getAccessToken, permissions,
}: CostSimAppProps) {
  // Initialise the API client with Platform's token getter (fresh per call,
  // survives token rotation — same pattern as ConfigIQ's api.ts)
  initApi(apiBaseUrl, getAccessToken);

  const setPermissions = usePermStore(s => s.setPermissions);
  if (permissions) setPermissions(permissions, isPlatformAdmin);

  const canSimulate    = isPlatformAdmin || !!permissions?.viewSimulate;
  const canInteragency = isPlatformAdmin || !!permissions?.viewSimulate || !!permissions?.viewInteragency;
  const canData        = isPlatformAdmin || !!permissions?.manageData;

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route index element={canSimulate ? <VisualizerPage /> : <Navigate to="interagency" />} />
        {canSimulate && (
          <>
            <Route path="eligibility"  element={<EligibilityPage />} />
            <Route path="combinations" element={<CombinationsPage />} />
          </>
        )}
        {canInteragency && <Route path="interagency" element={<InteragencyPage />} />}
        {canData        && <Route path="data"        element={<DataPage />} />}
        <Route path="*" element={<Navigate to="" />} />
      </Routes>
    </QueryClientProvider>
  );
}
