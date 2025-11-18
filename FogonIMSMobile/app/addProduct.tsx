import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../src/api/client";
import { router } from "expo-router";

const COLORS = {
  bg: "#f4f5f9",
  card: "#ffffff",
  primary: "#f97316", // orange
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
};

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
      Alert.alert(
        "Permission needed",
        "Photos access is required to attach an image."
      );
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
            <Text style={styles.title}>Add Product</Text>
            <Text style={styles.subtitle}>
              Create a new item for your inventory
            </Text>

            <Text style={styles.label}>Product Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Avocado"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Price</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              placeholder="Brief details about this item..."
              placeholderTextColor={COLORS.muted}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Image</Text>
            <View style={styles.imageSection}>
              <TouchableOpacity style={styles.outlineButton} onPress={pickImage}>
                <Text style={styles.outlineButtonText}>Pick Image</Text>
              </TouchableOpacity>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.preview} />
              ) : (
                <Text style={styles.noImageText}>No image selected</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving..." : "Save Product"}
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
    justifyContent: "center", // centers the card vertically like login
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
  imageSection: {
    marginTop: 4,
    marginBottom: 16,
    gap: 8,
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noImageText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  primaryButton: {
    marginTop: 4,
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
  outlineButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 15,
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
});
