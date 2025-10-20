import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, ActivityIndicator } from "react-native";
import api from "../api/client";

export default function AddProductScreen({ navigation, route }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Product name is required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/products", {
        name: name.trim(),
        quantity: Number(quantity || 0),
        price: Number(price || 0),
        description: description.trim(),
      });
      // call back to refresh list if provided
      route?.params?.onAdded?.();
      Alert.alert("Success", "Product created.");
      navigation.goBack();
    } catch (e) {
      // 403 when not manager, others are validation/server errors
      const msg = e?.response?.data?.error || "Failed to create product.";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>New Product</Text>

      <TextInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />

      <TextInput
        placeholder="Quantity (number)"
        keyboardType="number-pad"
        value={quantity}
        onChangeText={setQuantity}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />

      <TextInput
        placeholder="Price (e.g., 9.99)"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />

      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
        multiline
      />

      <Button title={saving ? "Saving…" : "Create Product"} onPress={submit} disabled={saving} />
      {saving ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}

      <Text style={{ marginTop: 12, opacity: 0.6 }}>
        Note: only users with the “manager” role can create products.
      </Text>
    </View>
  );
}
