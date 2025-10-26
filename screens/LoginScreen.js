import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, ActivityIndicator } from "react-native";
import api from "../api/client";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username || !password) {
      Alert.alert("Missing info", "Enter username and password.");
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.post("/login", { username, password });
      // parent App.js will save the token & role
      onLogin?.(data.access_token, data.role);
    } catch (e) {
      Alert.alert("Login failed", "Check username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", textAlign: "center" }}>FogonIMS</Text>
      <TextInput
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <Button title={loading ? "Signing in..." : "Sign In"} onPress={submit} disabled={loading} />
      {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
      <Text style={{ marginTop: 12, opacity: 0.6, textAlign: "center" }}>
        manager / Manager123! 
      </Text>
    </View>
  );
}
