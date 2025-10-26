import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api/client";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
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
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 6, opacity: 0.6 }}>Loading product…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.h1}>Edit Product</Text>
      </View>

      {/* Fields */}
      <View style={styles.section}>
        <Text style={styles.label}>Product Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g., Avocado"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />
        </View>
        <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Price</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 100 }]}
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Brief details about this item..."
        />
      </View>

      <Button title={saving ? "Saving..." : "Save Changes"} onPress={save} disabled={saving} />
      <View style={{ marginTop: 12 }}>
        <Button title="Back" color="#555" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
  h1: { fontSize: 24, fontWeight: "700", marginLeft: 8 },
  section: { marginBottom: 16 },
  row: { flexDirection: "row" },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16,
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
});
