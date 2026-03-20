import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "dev-secret-key";

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
});

export async function reconcileMedication(payload) {
  const { data } = await client.post("/api/reconcile/medication", payload);
  return data;
}

export async function validateDataQuality(payload) {
  const { data } = await client.post("/api/validate/data-quality", payload);
  return data;
}
