// src/api/client.js
import axios from "axios";
import * as SecureStore from "expo-secure-store";

// ✅ Point this to your local Flask API
const API_BASE_URL = "http://192.168.1.6:5001/api"; // change IP if needed

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Save, load, clear JWT token securely
export async function saveToken(token) {
  await SecureStore.setItemAsync("token", token);
}

export async function loadToken() {
  return await SecureStore.getItemAsync("token");
}

export async function clearToken() {
  await SecureStore.deleteItemAsync("token");
}

// Helper for authorized requests
api.interceptors.request.use(async (config) => {
  const token = await loadToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
