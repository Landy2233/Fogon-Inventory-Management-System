// app/request.tsx  → Cook creates a new stock request
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api/client";
import { router } from "expo-router";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
};

const COLORS = {
  primary: "#F97316",
  bg: "#ffffff",
  text: "#111827",
  border: "#E5E7EB",
};

export default function RequestProduct() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- load products ---
  async function loadProducts() {
    try {
      setLoading(true);
      const { data } = await api.get("/products");
      setProducts(data);
      setFiltered(data);
    } catch (e) {
      Alert.alert("Error", "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // --- filter products ---
  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(products);
      return;
    }
    const lower = text.toLowerCase();
    setFiltered(products.filter((p) => p.name.toLowerCase().includes(lower)));
  };

  // --- submit request ---
  async function submitRequest() {
    if (!selected) return Alert.alert("Select Product", "Please select a product.");

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0)
      return Alert.alert("Invalid quantity", "Quantity must be greater than 0.");

    try {
      setSubmitting(true);
      const body = { product_id: selected.id, quantity: qty };
      const { data } = await api.post("/requests", body);
      Alert.alert("Request Submitted", `Request #${data.id} created.`);
      router.replace("/inventory");
    } catch (err) {
      Alert.alert("Error", "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.h1}>Request Product</Text>
          <View style={{ width: 24 }} /> 
        </View>

        {/* Search bar */}
        <TextInput
          style={styles.search}
          placeholder="🔍 Search product..."
          value={search}
          onChangeText={handleSearch}
        />

        {/* Loading */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            style={{ flex: 1, marginTop: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.card,
                  selected?.id === item.id && styles.selectedCard,
                ]}
                onPress={() => setSelected(item)}
              >
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.subText}>
                  Qty: {item.quantity} • ${item.price.toFixed(2)}
                </Text>
                {item.description ? (
                  <Text style={styles.desc}>{item.description}</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        )}

        {/* Request form */}
        {selected && (
          <View style={styles.requestBox}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              keyboardType="number-pad"
              onChangeText={setQuantity}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={submitRequest}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  search: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    fontSize: 16,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  selectedCard: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF7ED",
  },
  name: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  subText: { opacity: 0.7, marginTop: 2 },
  desc: { opacity: 0.6, marginTop: 2 },

  requestBox: { marginTop: 10, paddingHorizontal: 16 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
