// Exported so Platform can inspect CostSim routes without importing the full app
export const COSTSIM_ROUTES = [
  { path: "/costsim",             label: "Costing Visualizer",       icon: "Calculator" },
  { path: "/costsim/eligibility", label: "Eligibility Check",        icon: "CheckCircle" },
  { path: "/costsim/combinations",label: "Costing Combinations",     icon: "Table" },
  { path: "/costsim/interagency", label: "Combinations · Interagency", icon: "Globe" },
  { path: "/costsim/data",        label: "Synced Data",              icon: "Database" },
] as const;
