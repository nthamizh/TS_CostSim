let _getAccessToken: (() => string | null) | null = null;
let _apiBaseUrl = "";
export function initApi(baseUrl: string, getToken: () => string | null) {
  _apiBaseUrl = baseUrl; _getAccessToken = getToken;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = _getAccessToken?.();
  const res = await fetch(`${_apiBaseUrl}/v1/costsim${path}`, {
    ...options,
    headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}), ...(options.headers??{}) },
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}
export const api = {
  simulate: (body: unknown) => request("/costing/simulate", { method:"POST", body:JSON.stringify(body) }),
  getData:  (table: string) => request(`/costing/data/${table}`),
};
