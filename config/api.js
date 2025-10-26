// DEV: your Mac's Wi-Fi IP + Flask port
const LOCAL = "http://192.168.1.6:5001";   
// PROD: your future hosted API URL (when deployed)
const PROD  = "https://api.fogonims.com";  // ← placeholder

// __DEV__ is true in Expo/React Native development builds
export const BASE_URL = __DEV__ ? LOCAL : PROD;
