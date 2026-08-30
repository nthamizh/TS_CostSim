import { create } from "zustand";
import type { CostSimPermissions } from "@costsim/types";
interface PermState {
  permissions: CostSimPermissions | null;
  isPlatformAdmin: boolean;
  setPermissions: (p: CostSimPermissions, isAdmin: boolean) => void;
}
export const usePermStore = create<PermState>(set => ({
  permissions: null, isPlatformAdmin: false,
  setPermissions: (permissions, isPlatformAdmin) => set({ permissions, isPlatformAdmin }),
}));
export const canSimulate    = (s: PermState) => s.isPlatformAdmin || !!s.permissions?.viewSimulate;
export const canInteragency = (s: PermState) => s.isPlatformAdmin || !!s.permissions?.viewSimulate || !!s.permissions?.viewInteragency;
export const canManageData  = (s: PermState) => s.isPlatformAdmin || !!s.permissions?.manageData;
