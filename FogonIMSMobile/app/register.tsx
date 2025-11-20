// app/register.tsx
import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, saveToken } from "../src/api/client";

const ORANGE = "#F97316";
const INK = "#111827";

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
};

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"cook" | "manager">("cook");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !username || !password) {
      Alert.alert("Missing info", "Name, username and password are required.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don’t match", "Please re-enter your password.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name,
        username,
        email: email || null,
        password,
        role, // "cook" or "manager"
      };

      const { data } = await api.post("/register", payload);
      // data: { ok, id, username, name, role, access_token }
      await saveToken(data.access_token);
      Alert.alert("Welcome", `Account created as ${data.role}.`);
      router.replace("/inventory");
    } catch (e: any) {
      console.log("Register error:", e?.response?.data || e.message);
      const msg =
        e?.response?.data?.error ||
        "Could not create account. Try a different username/email.";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <Text style={styles.headerTitle}>Create account</Text>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Image
                source={require("../assets/images/fogon_logo.png")}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Name */}
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={{ height: 10 }} />

            {/* Username */}
            <View style={styles.inputRow}>
              <Ionicons name="at-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={{ height: 10 }} />

            {/* Email (optional) */}
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Email (optional)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={{ height: 10 }} />

            {/* Password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={{ height: 10 }} />

            {/* Confirm Password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
            </View>

            {/* Role toggle */}
            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "cook" && { backgroundColor: ORANGE },
                ]}
                onPress={() => setRole("cook")}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === "cook" && { color: "#fff" },
                  ]}
                >
                  Cook
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "manager" && { backgroundColor: "#16A34A" },
                ]}
                onPress={() => setRole("manager")}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === "manager" && { color: "#fff" },
                  ]}
                >
                  Manager
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Create account</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Back to login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={goToLogin}>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FA" },
  container: {
    flex: 1,
    padding: 24,
    alignItems: "stretch",
    justifyContent: "flex-start",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
    color: INK,
  },

  logoWrap: { alignItems: "center", marginBottom: 8, marginTop: 4 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  logo: { width: "100%", height: "100%" },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EEE",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },

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
    marginLeft: 8,
    fontSize: 15,
    color: INK,
  },

  roleLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontWeight: "600",
    color: INK,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  roleText: {
    fontSize: 14,
    fontWeight: "600",
    color: INK,
  },

  button: {
    marginTop: 12,
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },
  footerText: { color: "#6B7280" },
  footerLink: { color: "#2563EB", fontWeight: "600" },
});
