let _getAccessToken: (() => string | null) | null = null;
let _apiBaseUrl = "";

export function initApi(baseUrl: string, getToken: () => string | null) {
  _apiBaseUrl = baseUrl;
  _getAccessToken = getToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = _getAccessToken?.();
  const res = await fetch(`${_apiBaseUrl}/v1/costsim${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const msg = typeof json.error === "string"
      ? json.error
      : JSON.stringify(json.error ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return json.data as T;
}

export const api = {
  // Simulator
  simulate: (body: unknown) =>
    request("/costing/simulate", { method: "POST", body: JSON.stringify(body) }),

  // Dropdowns — all LOV + distinct source values for form inputs
  getDropdowns: () =>
    request("/costing/dropdowns"),

  // Eligibility grid — server resolves all combinations for elem+acctType
  getEligibility: (params: { elem: string; acctType?: string; date?: string }) =>
    request(`/costing/eligibility?${new URLSearchParams(Object.entries(params).filter(([,v]) => v) as [string,string][])}`),

  // Combinations grid — server runs full costing hierarchy resolution
  getCombinations: (params: {
    elem: string; atype?: string; agency?: string; cc?: string;
    leFilter?: string; pg1Filter?: string; pg2Filter?: string;
    costType?: string; eligOnly?: string; date?: string;
  }) =>
    request(`/costing/combinations?${new URLSearchParams(Object.entries(params).filter(([,v]) => v) as [string,string][])}`),

  // Interagency — server applies LE PPG EL + segment overrides
  getInteragency: (params: {
    elem: string; ia: string; atype?: string; agency?: string; cc?: string;
    pg1Filter?: string; pg2Filter?: string;
    costType?: string; eligOnly?: string; date?: string;
  }) =>
    request(`/costing/interagency?${new URLSearchParams(Object.entries(params).filter(([,v]) => v) as [string,string][])}`),

  // Raw table data for Synced Data page
  getData: (table: string) =>
    request(`/costing/data/${table}`),
};
