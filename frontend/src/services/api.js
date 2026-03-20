import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  console.error("[api] VITE_API_KEY is not set — requests will be rejected by the server.");
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY ?? "",
  },
});

/**
 * Recursively sanitize a value before it is sent to the API:
 *  - strings  → trimmed; empty string → undefined (omitted from payload)
 *  - arrays   → items individually sanitized; empty items removed
 *  - objects  → each value recursively sanitized; keys with undefined value omitted
 *  - numbers / booleans / null → passed through unchanged
 */
function sanitize(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    return value
      .map(sanitize)
      .filter((v) => v !== undefined && v !== null && v !== "");
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = sanitize(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value; // number, boolean, null
}

export async function reconcileMedication(payload) {
  const { data } = await client.post("/api/reconcile/medication", sanitize(payload));
  return data;
}

export async function validateDataQuality(payload) {
  const { data } = await client.post("/api/validate/data-quality", sanitize(payload));
  return data;
}
