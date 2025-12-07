// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";

// Keep splash visible until fonts load
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      {/* Auth */}
      <Stack.Screen name="login" />

      {/* Main screens */}
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="inventory" />
      <Stack.Screen name="addProduct" />
      <Stack.Screen name="editProduct" />
      <Stack.Screen name="request" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="bulkImport" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}
