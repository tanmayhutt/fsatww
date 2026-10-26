const BASE = import.meta.env.VITE_API_BASE || "";

async function get(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BASE}${path}${query ? `?${query}` : ""}`);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = (await response.json()).detail || detail;
    } catch {
      // body was not JSON
    }
    throw new Error(detail);
  }
  return response.json();
}

export const api = {
  meta: () => get("/api/meta"),
  decision: (day, decisionTime) => get("/api/decision", { day, decisionTime }),
  accuracy: (decisionTime) => get("/api/accuracy", { decisionTime }),
  actuals: () => get("/api/actuals"),
};
