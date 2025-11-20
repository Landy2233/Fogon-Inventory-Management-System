// DEV: your Mac's Wi-Fi IP + Flask port
// const LOCAL = "http://192.168.1.15:5001"; // updated to match Flask logs
const LOCAL = "http://127.0.0.1:5001"; // or "http://localhost:5001"
// 10.136.12.77
// PROD: your future hosted API URL (when deployed)
const PROD = "https://api.fogonims.com"; // still just a placeholder

export const BASE_URL = __DEV__ ? LOCAL : PROD;
