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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔐 Forgot-password state
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      const { data } = await api.post("/login", { username, password });
      await saveToken(data.access_token);
      Alert.alert("Welcome", `Role: ${data.role}`);
      router.replace("/HomeScreen");
    } catch (e: any) {
      Alert.alert("Login failed", "Check username and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Toggle the forgot-password panel instead of showing a static alert
    setShowForgot((prev) => !prev);
  };

  const submitPasswordReset = async () => {
    const email = resetEmail.trim();
    if (!email) {
      Alert.alert("Missing email", "Please enter the email for your account.");
      return;
    }

    try {
      setResetLoading(true);
      // Backend: /api/password/forgot -> client baseURL already includes /api
      await api.post("/password/forgot", { email });
      Alert.alert(
        "Check your email",
        "If an account exists with that email, a reset link has been sent."
      );
      setShowForgot(false);
      setResetEmail("");
    } catch (err: any) {
      console.log("forgot password error", err?.response?.data || err);
      Alert.alert(
        "Error",
        "We couldn't start the password reset. Please try again later."
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {/* ===== ORANGE HERO HEADER ===== */}
          <View style={styles.hero}>
            <View style={styles.cubeLarge} />
            <View style={styles.cubeSmall} />
          </View>

          {/* ===== WHITE CARD ===== */}
          <View style={styles.cardWrapper}>
            <View style={styles.card}>
              {/* LOGO + FogonIMS text inside card */}
              <View style={styles.logoRow}>
                <View style={styles.logoCircle}>
                  <Image
                    source={require("../assets/images/fogon_logo.png")}
                    style={styles.logo}
                  />
                </View>
                <View>
                  <Text style={styles.appTitle}>FogonIMS</Text>
                  <Text style={styles.appSubtitle}>POS Inventory App</Text>
                </View>
              </View>

              {/* SIGN IN Heading */}
              <Text style={styles.signInTitle}>Sign In</Text>
              <Text style={styles.signInSubtitle}>
                Access your FogonIMS account
              </Text>

              {/* USERNAME */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Username</Text>
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your username"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>

              <View style={{ height: 14 }} />

              {/* PASSWORD */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {/* LOGIN BUTTON */}
              <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.7 }]}
                onPress={submit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.buttonInner}>
                    <Ionicons name="log-in-outline" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Login</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* FORGOT PASSWORD */}
              <View style={styles.forgotWrap}>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* 🔐 INLINE FORGOT-PASSWORD PANEL */}
              {showForgot && (
                <View style={styles.resetBox}>
                  <Text style={styles.resetTitle}>Reset your password</Text>
                  <Text style={styles.resetHint}>
                    Enter the email linked to your account. If it exists, we&apos;ll
                    send a reset link.
                  </Text>

                  <View style={[styles.inputRow, { marginTop: 8 }]}>
                    <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.resetButton,
                      resetLoading && { opacity: 0.7 },
                    ]}
                    onPress={submitPasswordReset}
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.resetButtonText}>Send reset link</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* CREATE ACCOUNT */}
              <View style={styles.signupWrap}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/register")}>
                  <Text style={styles.signupLink}>Create account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ===== COLORS ===== */
const ORANGE = "#F97316";
const ORANGE_DARK = "#EA580C";
const INK = "#111827";

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ORANGE_DARK,
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  /* ===== HERO HEADER ===== */
  hero: {
    height: "38%",
    backgroundColor: ORANGE_DARK,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },

  cubeLarge: {
    position: "absolute",
    right: -40,
    top: -20,
    width: 160,
    height: 160,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    transform: [{ rotate: "12deg" }],
  },
  cubeSmall: {
    position: "absolute",
    right: 40,
    top: 90,
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    transform: [{ rotate: "16deg" }],
  },

  /* ===== CARD ===== */
  cardWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -60,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 4 }),
  },

  /* ===== LOGO ROW ===== */
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF7ED",
    overflow: "hidden",
    marginRight: 12,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  appTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: INK,
  },
  appSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },

  /* ===== SIGN IN TEXT ===== */
  signInTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: INK,
    textAlign: "center",
    letterSpacing: 0.3,
    marginTop: 8,
    marginBottom: 2,
  },
  signInSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },

  /* ===== INPUTS ===== */
  fieldLabelRow: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  input: {
    flex: 1,
    paddingLeft: 8,
    fontSize: 15,
    color: INK,
  },

  /* ===== BUTTON ===== */
  button: {
    marginTop: 20,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 3 }),
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  forgotWrap: {
    alignItems: "center",
    marginTop: 14,
  },
  forgotText: {
    color: ORANGE,
    fontWeight: "600",
    fontSize: 13,
  },

  /* 🔐 Forgot password panel */
  resetBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  resetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: INK,
  },
  resetHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  resetButton: {
    marginTop: 10,
    backgroundColor: ORANGE_DARK,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  signupWrap: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  signupText: {
    color: "#6B7280",
    fontSize: 13,
  },
  signupLink: {
    color: ORANGE_DARK,
    fontWeight: "700",
    fontSize: 13,
  },
});

