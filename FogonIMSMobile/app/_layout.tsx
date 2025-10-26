// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";

// Keep Splash visible while we load fonts
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // ✅ This path is correct for @expo/vector-icons Ionicons
  const [fontsLoaded] = useFonts({
    Ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null; // 👈 splash stays up instead of white screen

  return <Stack screenOptions={{ headerShown: false }} />;
}
