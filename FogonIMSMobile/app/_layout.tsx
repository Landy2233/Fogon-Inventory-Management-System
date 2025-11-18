// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";

// Keep Splash visible while we load fonts
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // ✅ Load Ionicons font for @expo/vector-icons
  const [fontsLoaded] = useFonts({
    Ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null; // keep splash instead of flashing white screen

  return (
    <Stack
      screenOptions={{
        headerShown: false, // we use custom headers inside each screen
        animation: "slide_from_right",
      }}
    >
      {/* Auth */}
      <Stack.Screen name="login" />

      {/* Main app screens */}
      <Stack.Screen name="inventory" />
      <Stack.Screen name="addProduct" />
      <Stack.Screen name="editProduct" />
      <Stack.Screen name="request" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

