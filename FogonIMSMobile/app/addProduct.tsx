import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../src/api/client";
import { router } from "expo-router";

export default function AddProduct() {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [price, setPrice] = useState("0");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photos access is required to attach an image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled) {
      setImageUri(res.assets[0].uri);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a product name.");
      return;
    }
    const qty = Number(quantity);
    const pr = Number(price);
    if (Number.isNaN(qty) || Number.isNaN(pr)) {
      Alert.alert("Invalid values", "Quantity and price must be numbers.");
      return;
    }

    const form = new FormData();
    form.append("name", name.trim());
    form.append("quantity", String(qty));
    form.append("price", String(pr));
    form.append("description", description.trim());

    if (imageUri) {
      const filename = imageUri.split("/").pop() || `photo-${Date.now()}.jpg`;
      const ext = (/\.(\w+)$/i.exec(filename)?.[1] || "jpg").toLowerCase();
      const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
      form.append("image", { uri: imageUri, name: filename, type } as any);
    }

    try {
      setSaving(true);
      const { data } = await api.post("/products", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Alert.alert("✅ Success", `Product created (id ${data.id})`);
      router.replace("/inventory");
    } catch (e: any) {
      console.error(e?.response?.data || e);
      Alert.alert(
        "❌ Error",
        e?.response?.data?.error ||
          "Only managers can create products or the data is invalid."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Add Product</Text>

      <Text style={styles.label}>Product Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Avocado"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Quantity</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={quantity}
        onChangeText={setQuantity}
      />

      <Text style={styles.label}>Price</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        multiline
        placeholder="Brief details about this item..."
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Image</Text>
      <View style={{ gap: 8, marginBottom: 12 }}>
        <Button title="Pick Image" onPress={pickImage} />
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <Text style={{ opacity: 0.6 }}>No image selected</Text>
        )}
      </View>

      <Button title={saving ? "Saving..." : "Save"} onPress={save} disabled={saving} />
      <View style={{ marginTop: 12 }}>
        <Button title="Back" color="#555" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#fff" },
  h1: { fontSize: 28, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 6, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
});
