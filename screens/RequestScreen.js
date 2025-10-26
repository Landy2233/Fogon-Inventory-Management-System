// src/screens/RequestScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from "react-native";
import api from "../api/client";

export default function RequestScreen() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const { data } = await api.get("/products");
        setProducts(data);
      } catch (e) {
        Alert.alert("Error", "Failed to load products.");
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const submitRequest = async () => {
    if (!selectedProduct || !quantity) {
      Alert.alert("Missing fields", "Select a product and enter quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/requests", {
        product_id: selectedProduct.id,
        quantity: parseInt(quantity, 10),
      });
      Alert.alert("Success", "Stock request submitted!");
      setSelectedProduct(null);
      setQuantity("");
    } catch (e) {
      const msg = e?.response?.data?.error || "Failed to submit request.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading products…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 16 }}>
        Request Stock
      </Text>

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedProduct(item)}
            style={{
              borderWidth: 1,
              borderColor:
                selectedProduct?.id === item.id ? "#4caf50" : "#ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
              backgroundColor:
                selectedProduct?.id === item.id ? "#e8f5e9" : "white",
            }}
          >
            <Text style={{ fontWeight: "600" }}>{item.name}</Text>
            <Text>Available: {item.quantity}</Text>
          </TouchableOpacity>
        )}
      />

      {selectedProduct && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>
            Selected: {selectedProduct.name}
          </Text>
          <TextInput
            placeholder="Enter quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderRadius: 8,
              padding: 10,
              marginTop: 8,
            }}
          />
          <Button
            title={submitting ? "Submitting..." : "Submit Request"}
            onPress={submitRequest}
            disabled={submitting}
          />
        </View>
      )}
    </View>
  );
}
