import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../src/api/client";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
};

const COLORS = {
  bg: "#f4f5f9",
  card: "#ffffff",
  primary: "#f97316",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
};

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = useMemo(() => Number(id), [id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [price, setPrice] = useState("0");
  const [description, setDescription] = useState("");

  async function load() {
    if (!Number.isFinite(productId)) {
      Alert.alert("Invalid", "Missing product id.");
      router.back();
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get<Product>(`/products/${productId}`);
      setName(data.name ?? "");
      setQuantity(String(data.quantity ?? 0));
      setPrice(String(data.price ?? 0));
      setDescription(data.description ?? "");
    } catch (e: any) {
      console.error("load error", e?.response?.data || e?.message);
      Alert.alert("Error", "Unable to load product.");
      router.replace("/inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function save() {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a product name.");
      return;
    }
    const payload = {
      name: name.trim(),
      quantity: Number(quantity),
      price: Number(price),
      description: description.trim(),
    };
    if (Number.isNaN(payload.quantity) || Number.isNaN(payload.price)) {
      Alert.alert("Invalid values", "Quantity and price must be numbers.");
      return;
    }

    try {
      setSaving(true);
      await api.put(`/products/${productId}`, payload);
      Alert.alert("Saved", "Product updated successfully.");
      router.replace("/inventory");
    } catch (e: any) {
      console.error("save error", e?.response?.data || e?.message);
      const msg =
        e?.response?.data?.error ||
        "Failed to update product. Make sure you are logged in as 'manager'.";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
          <Text style={styles.loaderText}>Loading product…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>Edit Product</Text>
            <Text style={styles.subtitle}>Update this item’s information</Text>

            <Text style={styles.label}>Product Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Avocado"
              placeholderTextColor={COLORS.muted}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="0"
                  placeholderTextColor={COLORS.muted}
                />
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Price</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                />
              </View>
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Brief details about this item..."
              placeholderTextColor={COLORS.muted}
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textButton}
              onPress={() => router.back()}
            >
              <Text style={styles.textButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: "center", // center card vertically like AddProduct
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  textButton: {
    marginTop: 10,
    alignItems: "center",
  },
  textButtonText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    marginTop: 6,
    color: COLORS.muted,
  },
});
