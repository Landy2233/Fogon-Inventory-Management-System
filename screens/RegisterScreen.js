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

export default function RegisterScreen({ navigation, onLogin }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cook"); // default
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !username || !password) {
      Alert.alert(
        "Missing info",
        "Full name, username, and password are required."
      );
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
      onLogin?.(data.access_token, data.role);
    } catch (e) {
      console.log("Register error:", e?.response?.data || e.message);
      const msg =
        e?.response?.data?.error ||
        "Unable to create account. Try a different username/email.";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text
        style={{
          fontSize: 26,
          fontWeight: "700",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Create account
      </Text>
      <Text
        style={{
          fontSize: 13,
          opacity: 0.6,
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        Choose your role and start managing Fogon inventory.
      </Text>

      {/* Full name */}
      <TextInput
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        style={{
          borderWidth: 1,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      />

      {/* Username */}
      <TextInput
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        style={{
          borderWidth: 1,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      />

      {/* Email (optional) */}
      <TextInput
        placeholder="Email (optional)"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
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
          borderRadius: 10,
          padding: 12,
          marginBottom: 14,
        }}
      />

      {/* Role selector */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 6, fontWeight: "600" }}>Role</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => setRole("cook")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              alignItems: "center",
              backgroundColor: role === "cook" ? "#f97316" : "white",
            }}
          >
            <Text style={{ color: role === "cook" ? "white" : "#222" }}>
              Cook
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRole("manager")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              alignItems: "center",
              backgroundColor: role === "manager" ? "#16a34a" : "white",
            }}
          >
            <Text style={{ color: role === "manager" ? "white" : "#222" }}>
              Manager
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create account button */}
      <Button
        title={loading ? "Creating account..." : "Create Account"}
        onPress={handleRegister}
        disabled={loading}
      />

      {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}

      {/* Back to login */}
      <View
        style={{
          marginTop: 20,
          flexDirection: "row",
          justifyContent: "center",
        }}
      >
        <Text>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: "#2563eb", fontWeight: "600" }}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
