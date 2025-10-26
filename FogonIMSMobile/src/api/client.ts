import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

// --- Toggle this when testing on simulator vs physical device ---
const USE_SIMULATOR = true;
const API_BASE_URL = USE_SIMULATOR
  ? "http://127.0.0.1:5001/api"     // iOS Simulator on your Mac
  : "http://192.168.1.3:5001/api";  // Physical phone on same Wi-Fi (PUT YOUR MAC IP)

export const api = axios.create({
  baseURL: API_BASE_URL,
  
  headers: { "Content-Type": "application/json" },
});

// ---------------- Token Helpers ----------------
export async function saveToken(token: string) {
  await SecureStore.setItemAsync("token", token);
  console.log("✅ Saved token:", token.slice(0, 16) + "...");
}

export async function loadToken() {
  const t = await SecureStore.getItemAsync("token");
  return t;
}

export async function clearToken() {
  await SecureStore.deleteItemAsync("token");
  console.log("🚪 Cleared token");
}

// ---------------- Request Interceptor ----------------
api.interceptors.request.use(async (cfg) => {
  const t = await loadToken();
  if (t) {
    (cfg.headers as any).Authorization = `Bearer ${t}`;
    // console.log("→ attaching Authorization");
  }
  return cfg;
});

// ---------------- Response Interceptor ----------------
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // Token invalid/expired → force logout
      await clearToken();
      try {
        router.replace("/login");
      } catch {}
    }
    return Promise.reject(err);
  }
);

// ---------------- Convenience ----------------
export async function fetchCurrentUser() {
  const { data } = await api.get("/me");
  return data as { id: number; username: string; role?: string };
}
