// src/api/client.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

/**
 * DEV BACKEND BASE URL
 *
 * Flask server running on your Mac:
 *   http://192.168.1.6:5001
 */
const DEV_LAN = "http://192.168.1.6:5001/api"; // ⬅️ your Mac IP + /api
const PROD = "https://api.fogonims.com/api"; // placeholder for future deploy

const API_BASE_URL = __DEV__ ? DEV_LAN : PROD;

// ---------------- Token key ----------------
const TOKEN_KEY = "token"; // SecureStore key – keep consistent everywhere

// ---------------- Axios instance ----------------
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ---------------- Token Helpers ----------------

/**
 * Save JWT token securely on the device and log a short preview in console.
 * Call this right after a successful login.
 */
export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  console.log("✅ Saved token:", token.slice(0, 16) + "...");
}

/**
 * Load token from secure storage (if any).
 */
export async function loadToken() {
  const t = await SecureStore.getItemAsync(TOKEN_KEY);
  return t;
}

/**
 * Clear token from secure storage and log event.
 * Called on logout or when a 401 tells us the token is invalid.
 */
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  console.log("🚪 Cleared token");
}

/**
 * Optional: pre-load token and set default Authorization header once
 * (e.g., on app startup in _layout.tsx).
 */
export async function initApiAuth() {
  const t = await loadToken();
  if (t) {
    (api.defaults.headers as any).Authorization = `Bearer ${t}`;
    console.log("🔐 Initialized API auth with token:", t.slice(0, 16) + "...");
  }
}

// ---------------- Request Interceptor ----------------

/**
 * Before every request, automatically attach:
 *   Authorization: Bearer <token>
 * if a token is present in SecureStore.
 */
api.interceptors.request.use(
  async (cfg) => {
    const t = await loadToken();
    if (t) {
      (cfg.headers as any).Authorization = `Bearer ${t}`;
      // console.log("🔐 Using token:", t.slice(0, 16) + "...");
    } else {
      // Helpful for debugging 401s
      console.log(
        "⚠️ No token in SecureStore, sending request without Authorization"
      );
    }
    return cfg;
  },
  (error) => Promise.reject(error)
);

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
 * Returns { id, username, role, name }.
 */
export async function fetchCurrentUser() {
  const { data } = await api.get("/me");
  return data as {
    id: number;
    username: string;
    role?: string;
    name?: string;
  };
}
