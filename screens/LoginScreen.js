import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import api from "../api/client";

export default function LoginScreen({ navigation, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing info", "Enter username and password.");
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post("/login", { username, password });
      // backend returns: { access_token, role, username, name }
      onLogin?.(data.access_token, data.role);
    } catch (e) {
      console.log("Login error:", e?.response?.data || e.message);
      Alert.alert("Login failed", "Check username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
        backgroundColor: "white",
      }}
    >
      {/* Logo / Title (simple version – you can add Image here later) */}
      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        FogonIMS
      </Text>
      <Text
        style={{
          fontSize: 14,
          opacity: 0.6,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        Inventory made simple
      </Text>

      {/* Username */}
      <TextInput
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        style={{
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}
      />

      {/* Password */}
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      />

      {/* Login button */}
      <Button
        title={loading ? "Signing in..." : "Login"}
        onPress={handleLogin}
        disabled={loading}
      />

      {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}

      {/* Forgot password (just visual for now) */}
      <TouchableOpacity
        onPress={() =>
          Alert.alert("Info", "Forgot password flow not built yet.")
        }
        style={{ marginTop: 14, alignItems: "center" }}
      >
        <Text style={{ color: "#2563eb", fontWeight: "500" }}>
          Forgot Password?
        </Text>
      </TouchableOpacity>

      {/* *** THIS is the create-account option *** */}
      <View
        style={{
          marginTop: 22,
          flexDirection: "row",
          justifyContent: "center",
        }}
      >
        <Text>Don&apos;t have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={{ color: "#2563eb", fontWeight: "700" }}>
            Create account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Demo credentials for you / testers */}
      <Text
        style={{
          marginTop: 18,
          opacity: 0.6,
          textAlign: "center",
          fontSize: 12,
        }}
      >
        Demo accounts:
        {"\n"}manager / Manager123!
        {"\n"}cook / Cook123!
      </Text>
    </View>
  );
}
