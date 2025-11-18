import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {/* Logo + brand */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Image
                source={require("../assets/images/fogon_logo.png")}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brand}>FogonIMS</Text>
            <Text style={styles.subtitle}>Inventory made simple</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Username */}
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Username"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                returnKeyType="next"
              />
            </View>

            <View style={{ height: 10 }} />

            {/* Password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={submit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="log-in-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Login</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Forgot Password (centered, after button) */}
            <View style={styles.forgotWrap}>
              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ORANGE = "#F97316";
const INK = "#111827";

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FA" },
  container: {
    flex: 1,
    padding: 24,
    alignItems: "stretch",
    justifyContent: "center",
  },

  // Logo
  logoWrap: { alignItems: "center", marginBottom: 12 },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  logo: { width: "100%", height: "100%" },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: INK,
    marginTop: 12,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    paddingLeft: 8,
    fontSize: 16,
    color: INK,
  },

  // Forgot Password (centered)
  forgotWrap: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 6,
  },
  forgotText: {
    color: "#2563EB",
    fontWeight: "600",
    textAlign: "center",
  },

  // Login Button
  button: {
    marginTop: 14,
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Demo hint
  demoHint: {
    marginTop: 12,
    textAlign: "center",
    opacity: 0.65,
    fontSize: 13,
  },
});

