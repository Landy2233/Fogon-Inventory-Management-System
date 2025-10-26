// App.js
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";

import { loadToken, saveToken, clearToken } from "./src/api/client";
import LoginScreen from "./src/screens/LoginScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import AddProductScreen from "./src/screens/AddProductScreen";
import RequestScreen from "./src/screens/RequestScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null); // "manager" | "cook"

  useEffect(() => {
    (async () => {
      // restore token from client.js + role from secure storage
      const t = await loadToken();
      const r = await SecureStore.getItemAsync("role");
      setToken(t);
      setRole(r);
      setBooting(false);
    })();
  }, []);

  const onLogin = async (accessToken, userRole) => {
    await saveToken(accessToken);            // persists + attaches to axios
    await SecureStore.setItemAsync("role", userRole);
    setToken(accessToken);
    setRole(userRole);
  };

  const onLogout = async () => {
    await clearToken();                      // clears from axios + storage
    await SecureStore.deleteItemAsync("role");
    setToken(null);
    setRole(null);
  };

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!token ? (
          // --------- Auth flow ---------
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLogin={onLogin} />}
          </Stack.Screen>
        ) : (
          // --------- App flow ---------
          <>
            <Stack.Screen name="Inventory" options={{ title: "Inventory" }}>
              {(props) => (
                <InventoryScreen
                  {...props}
                  role={role}
                  onLogout={onLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="AddProduct"
              options={{ title: "Add Product" }}
              component={AddProductScreen}
            />

            <Stack.Screen
              name="Request"
              options={{ title: "Request Stock" }}
              component={RequestScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
