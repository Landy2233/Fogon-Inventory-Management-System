// app/request.tsx  → Cook creates OR edits a stock request

import React, { useEffect, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description?: string | null;
};

const COLORS = {
  primary: "#F97316",
  bg: "#F7F8FA",
  text: "#111827",
  border: "#E5E7EB",
  card: "#FFFFFF",
};

export default function RequestProduct() {
  // params are only present when we are EDITING an existing request
  const params = useLocalSearchParams<{
    requestId?: string;
    productId?: string;
    qty?: string;
  }>();

  const isEditing = !!params.requestId;

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ---------- load products ----------
  async function loadProducts() {
    try {
      setLoading(true);
      const { data } = await api.get<Product[]>("/products");
      setProducts(data);
      setFiltered(data);
    } catch (e) {
      console.log("❌ load products error", e);
      Alert.alert("Error", "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // when editing: once products are loaded, pre-select product + quantity
  useEffect(() => {
    if (!isEditing || products.length === 0) return;

    const pid = parseInt(params.productId ?? "", 10);
    const q = parseInt(params.qty ?? "", 10);

    if (!isNaN(pid)) {
      const prod = products.find((p) => p.id === pid);
      if (prod) setSelected(prod);
    }

    if (!isNaN(q) && q > 0) {
      setQuantity(String(q));
    }
  }, [isEditing, params.productId, params.qty, products]);

  // ---------- search filter ----------
  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(products);
      return;
    }
    const lower = text.toLowerCase();
    setFiltered(products.filter((p) => p.name.toLowerCase().includes(lower)));
  };

  // ---------- submit request (create OR update) ----------
  async function submitRequest() {
    if (!selected) {
      return Alert.alert("Select Product", "Please select a product first.");
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return Alert.alert(
        "Invalid quantity",
        "Quantity must be greater than 0."
      );
    }

    try {
      setSubmitting(true);
      const body = { product_id: selected.id, quantity: qty };

      if (isEditing && params.requestId) {
        // UPDATE existing request
        const url = `/requests/${params.requestId}`;
        const { data } = await api.put(url, body);
        console.log("Updated request", data);
        Alert.alert("Request Updated", "Your request has been updated.");
        router.replace("/requests"); // back to My Stock Requests
      } else {
        // CREATE new request (old behavior)
        const { data } = await api.post("/requests", body);
        console.log("Created request", data);
        Alert.alert("Request Submitted", `Request #${data.id} created.`);
        router.replace("/inventory"); // keep existing flow
      }
    } catch (err: any) {
      console.log("❌ submit request error", err?.response?.data || err);
      Alert.alert(
        "Error",
        isEditing ? "Unable to update request." : "Unable to submit request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- render product row ----------
  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.card, selected?.id === item.id && styles.cardSelected]}
      onPress={() => setSelected(item)}
    >
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.subText}>
        Qty: {item.quantity} · ${item.price.toFixed(2)}
      </Text>
      {item.description ? (
        <Text style={styles.desc}>{item.description}</Text>
      ) : null}
    </TouchableOpacity>
  );

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
          <Text style={styles.h1}>
            {isEditing ? "Edit Request" : "Request Product"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <Ionicons
            name="search"
            size={18}
            color="#9CA3AF"
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search product..."
            value={search}
            onChangeText={handleSearch}
          />
        </View>

        {/* Product list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            style={{ flex: 1, marginTop: 10 }}
            contentContainerStyle={{ paddingBottom: 130 }}
            renderItem={renderItem}
          />
        )}

        {/* Bottom quantity + submit bar */}
        <View style={styles.bottomBar}>
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.qtyInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="Enter quantity"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!selected || submitting) && { opacity: 0.7 },
            ]}
            disabled={!selected || submitting}
            onPress={submitRequest}
          >
            <Text style={styles.submitText}>
              {submitting
                ? isEditing
                  ? "Updating..."
                  : "Submitting..."
                : isEditing
                ? "Save Changes"
                : "Submit Request"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- styles ----------

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
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

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    backgroundColor: "#FFF",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.card,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF7ED",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  subText: {
    marginTop: 2,
    fontSize: 14,
    color: "#4B5563",
  },
  desc: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: COLORS.bg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    color: COLORS.text,
  },
  qtyInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    fontSize: 16,
    backgroundColor: "#FFF",
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  submitText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
