// src/api/client.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

/**
 * DEV BACKEND BASE URL
 *
 * Your Flask server is running on your Mac, e.g.:
 *   http://10.136.12.77:5001
 *
 * Replace DEV_LAN with your actual Wi-Fi IP.
 */
// const DEV_LAN = "http://10.136.12.77:5001/api"; // ⬅️ PUT YOUR MAC IP HERE
const DEV_LAN = "http://10.136.10.13:5001/api"; // ⬅️ PUT YOUR MAC IP HERE
const PROD = "https://api.fogonims.com/api"; // placeholder for future deploy

const API_BASE_URL = __DEV__ ? DEV_LAN : PROD;

// ---------------- Axios instance ----------------
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ---------------- Token Helpers ----------------

/**
 * Save JWT token securely on the device and log a short preview in console.
 * Called after a successful login.
 */
export async function saveToken(token: string) {
  await SecureStore.setItemAsync("token", token);
  console.log("✅ Saved token:", token.slice(0, 16) + "...");
}

/**
 * Load token from secure storage (if any).
 * Used when the app boots or before sending a request.
 */
export async function loadToken() {
  const t = await SecureStore.getItemAsync("token");
  return t;
}

/**
 * Clear token from secure storage and log event.
 * Called on logout or when a 401 tells us the token is invalid.
 */
export async function clearToken() {
  await SecureStore.deleteItemAsync("token");
  console.log("🚪 Cleared token");
}

// ---------------- Request Interceptor ----------------

/**
 * Before every request, automatically attach:
 *   Authorization: Bearer <token>
 * if a token is present in SecureStore.
 */
api.interceptors.request.use(async (cfg) => {
  const t = await loadToken();
  if (t) {
    (cfg.headers as any).Authorization = `Bearer ${t}`;
    // console.log("→ attaching Authorization");
  }
  return cfg;
});

// ---------------- Response Interceptor ----------------

/**
 * If the backend responds with 401 (unauthorized),
 * we assume token is invalid/expired → clear it and
 * navigate back to the login screen.
 */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      await clearToken();
      try {
        router.replace("/login");
      } catch {
        // ignore navigation errors if router isn't ready yet
      }
    }
    return Promise.reject(err);
  }
);

// ---------------- Convenience Helpers ----------------

/**
 * Helper to fetch the currently logged-in user from /api/me.
 * Returns { id, username, role }.
 */
export async function fetchCurrentUser() {
  const { data } = await api.get("/me");
  return data as { id: number; username: string; role?: string };
}
