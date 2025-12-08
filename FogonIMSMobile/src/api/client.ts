// src/api/client.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

/**
 * BACKEND URL — permanent Railway deployment
 * This is the only base URL used by the entire app.
 */
const API_BASE_URL =
  "https://fogon-inventory-management-system-production.up.railway.app/api";

// ---------------- Token key ----------------
const TOKEN_KEY = "token"; // SecureStore key – keep consistent everywhere

// ---------------- Axios instance ----------------
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ---------------- Token Helpers ----------------

/** Save JWT token securely */
export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  console.log("✅ Saved token:", token.slice(0, 16) + "...");
}

/** Load token */
export async function loadToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

/** Delete token */
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  console.log("🚪 Cleared token");
}

/** Initialize Authorization header on app startup */
export async function initApiAuth() {
  const t = await loadToken();
  if (t) {
    (api.defaults.headers as any).Authorization = `Bearer ${t}`;
    console.log("🔐 Initialized API auth with:", t.slice(0, 16) + "...");
  }
}

// ---------------- Request Interceptor ----------------

/** Attach Bearer token to every request */
api.interceptors.request.use(
  async (cfg) => {
    const t = await loadToken();
    if (t) {
      (cfg.headers as any).Authorization = `Bearer ${t}`;
    }
    return cfg;
  },
  (error) => Promise.reject(error)
);

// ---------------- Response Interceptor ----------------

/** Auto-logout on expired/invalid token */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 401) {
      await clearToken();
      try {
        router.replace("/login");
      } catch {}
    }
    return Promise.reject(err);
  }
);

// ---------------- Convenience Helpers ----------------

/** Get logged-in user */
export async function fetchCurrentUser() {
  const { data } = await api.get("/me");
  return data as {
    id: number;
    username: string;
    role?: string;
    name?: string;
  };
}
