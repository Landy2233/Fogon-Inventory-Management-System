import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api } from "../src/api/client";
import { router } from "expo-router";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
};

export default function RequestProduct() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);

  // --- load products ---
  async function loadProducts() {
    try {
      const { data } = await api.get("/products");
      setProducts(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Unable to load products.");
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // --- filter by name as user types ---
  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(products);
      return;
    }
    const lower = text.toLowerCase();
    const f = products.filter((p) => p.name.toLowerCase().includes(lower));
    setFiltered(f);
  };

  // --- send request ---
  const submitRequest = async () => {
    if (!selected) {
      Alert.alert("Select Product", "Please select a product to request.");
      return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Enter a valid quantity greater than 0.");
      return;
    }

    try {
      setLoading(true);
      const body = { product_id: selected.id, quantity: qty };
      const { data } = await api.post("/requests", body);
      Alert.alert("✅ Request Submitted", `Request #${data.id} created.`);
      router.replace("/inventory");
    } catch (e: any) {
      console.error(e);
      Alert.alert("❌ Error", "Unable to submit request or you are not authorized.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.h1}>Request Product</Text>

        <TextInput
          style={styles.search}
          placeholder="🔍 Search product name..."
          value={search}
          onChangeText={handleSearch}
        />

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
              <Text style={{ opacity: 0.6 }}>
                Qty: {item.quantity} | ${item.price.toFixed(2)}
              </Text>
              {item.description ? (
                <Text style={{ opacity: 0.5 }}>{item.description}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />

        {selected && (
          <View style={styles.requestBox}>
            <Text style={styles.label}>Quantity to Request</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />
            <Button
              title={loading ? "Submitting..." : "Submit Request"}
              onPress={submitRequest}
              disabled={loading}
            />
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <Button title="Back" color="#555" onPress={() => router.back()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  h1: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  search: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  selectedCard: {
    borderColor: "#007bff",
    backgroundColor: "#e8f0fe",
  },
  name: { fontSize: 18, fontWeight: "600" },
  requestBox: { marginTop: 10 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
  },
});
