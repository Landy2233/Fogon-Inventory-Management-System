import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { api, saveToken } from "../src/api/client";

export default function Login() {
  const [username, setUsername] = useState("manager");
  const [password, setPassword] = useState("Manager123!");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      const { data } = await api.post("/login", { username, password });
      await saveToken(data.access_token);
      Alert.alert("Welcome", `Role: ${data.role}`);
      router.replace("/inventory");
    } catch (e: any) {
      Alert.alert("Login failed", "Check username and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Forgot Password",
      "Please contact your administrator or manager to reset your password."
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FogonIMS</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleForgotPassword}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: "stretch",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 28,
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotText: {
    marginTop: 14,
    textAlign: "center",
    color: "#2563EB",
    fontWeight: "500",
  },
  demoHint: {
    marginTop: 14,
    textAlign: "center",
    opacity: 0.6,
    fontSize: 13,
  },
});
