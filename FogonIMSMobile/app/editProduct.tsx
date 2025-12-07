// app/editProduct.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../src/api/client";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
  image_url?: string | null;
  category?: string | null;
  vendor_name?: string | null;
  vendor_contact?: string | null;
};

const COLORS = {
  primary: "#F97316",
  bg: "#F7F8FA",
  card: "#FFFFFF",
  text: "#111827",
  border: "#E5E7EB",
  muted: "#6B7280",
};

const CATEGORY_OPTIONS = [
  { value: "Produce", label: "Produce" },
  { value: "Dry Goods", label: "Dry Goods" },
  { value: "Meat & Poultry", label: "Meat & Poultry" },
  { value: "Dairy", label: "Dairy" },
  { value: "Frozen", label: "Frozen" },
  { value: "Beverages", label: "Beverages" },
  { value: "Sauces & Condiments", label: "Sauces & Condiments" },
  { value: "Packaged", label: "Packaged" },
  { value: "Other", label: "Other" },
];

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [price, setPrice] = useState("0");
  const [description, setDescription] = useState("");
  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const [category, setCategory] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorContact, setVendorContact] = useState<string>("");

  const [categoryOpen, setCategoryOpen] = useState(false);

  const categoryLabel = (value: string) => {
    const found = CATEGORY_OPTIONS.find((c) => c.value === value);
    return found ? found.label : "Select category";
  };

  // ------------ Load existing product ------------
  async function loadProduct() {
    try {
      setLoading(true);
      const { data } = await api.get<Product>(`/products/${productId}`);
      setName(data.name || "");
      setQuantity(String(data.quantity ?? 0));
      setPrice(String(data.price ?? 0));
      setDescription(data.description || "");
      setServerImageUrl(data.image_url || null);
      setCategory((data.category as string) || "");
      setVendorName((data.vendor_name as string) || "");
      setVendorContact((data.vendor_contact as string) || "");
    } catch (err) {
      console.log("❌ load product error", err);
      Alert.alert("Error", "Unable to load product.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isNaN(productId)) loadProduct();
  }, [productId]);

  // ------------ Image picker ------------
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "We need access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  // ------------ Save ------------
  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing info", "Product name is required.");
      return;
    }

    const q = parseInt(quantity);
    const p = parseFloat(price);
    if (isNaN(q) || isNaN(p)) {
      Alert.alert("Invalid values", "Quantity and price must be numeric.");
      return;
    }

    try {
      setSaving(true);

      const form = new FormData();
      form.append("name", name.trim());
      form.append("quantity", String(q));
      form.append("price", String(p));
      form.append("description", description.trim());
      form.append("category", category || "");
      form.append("vendor_name", vendorName.trim());
      form.append("vendor_contact", vendorContact.trim());
      // If you later expose reorder_threshold, append here as well.

      // Only include "image" if user picked a new one
      if (localImageUri) {
        const fileName = localImageUri.split("/").pop() || "image.jpg";
        const ext = fileName.split(".").pop()?.toLowerCase();
        const mime =
          ext === "png"
            ? "image/png"
            : ext === "webp"
            ? "image/webp"
            : "image/jpeg";

        form.append("image", {
          uri: localImageUri,
          name: fileName,
          type: mime,
        } as any);
      }

      await api.put(`/products/${productId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Saved", "Product updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.log("❌ save error", err?.response?.data || err);
      const msg = err?.response?.data?.error || "Unable to save product.";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const displayImageUri = localImageUri
    ? localImageUri
    : serverImageUrl
    ? serverImageUrl // if you want full URL, prepend your API base here
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.title}>Edit Product</Text>
            <Text style={styles.subtitle}>Update this item’s information</Text>

            {/* Name */}
            <Text style={styles.label}>Product Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Avocado"
            />

            {/* Category dropdown */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setCategoryOpen((o) => !o)}
                activeOpacity={0.85}
              >
                <Text
                  style={
                    category ? styles.dropdownText : styles.dropdownPlaceholder
                  }
                >
                  {categoryLabel(category)}
                </Text>
                <Ionicons
                  name={categoryOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={COLORS.muted}
                />
              </TouchableOpacity>

              {categoryOpen && (
                <View style={styles.dropdownMenu}>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCategory(opt.value);
                        setCategoryOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          opt.value === category && {
                            color: COLORS.primary,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Quantity & Price */}
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  keyboardType="number-pad"
                  onChangeText={setQuantity}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Price</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  keyboardType="decimal-pad"
                  onChangeText={setPrice}
                />
              </View>
            </View>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Brief details about this item..."
            />

            {/* Vendor info */}
            <Text style={styles.label}>Vendor Name</Text>
            <TextInput
              style={styles.input}
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="e.g., Local Supplier"
            />

            <Text style={styles.label}>Vendor Contact</Text>
            <TextInput
              style={styles.input}
              value={vendorContact}
              onChangeText={setVendorContact}
              placeholder="Phone, email, etc."
            />

            {/* Image */}
            <Text style={styles.label}>Image</Text>
            <TouchableOpacity
              style={styles.imagePicker}
              onPress={pickImage}
              activeOpacity={0.85}
            >
              <Ionicons
                name="image-outline"
                size={18}
                color={COLORS.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.imagePickerText}>Pick Image</Text>
            </TouchableOpacity>
            <Text style={styles.imageHint}>
              {localImageUri
                ? "New image selected"
                : serverImageUrl
                ? "Using existing image (tap to change)"
                : "No image selected"}
            </Text>

            {displayImageUri && (
              <View style={{ marginTop: 10, alignItems: "center" }}>
                <Image
                  source={{ uri: displayImageUri }}
                  style={{ width: 120, height: 120, borderRadius: 16 }}
                />
              </View>
            )}

            {/* Save button */}
            <TouchableOpacity
              style={[styles.button, saving && { opacity: 0.85 }]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Back */}
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: "center" }}
              onPress={() => router.back()}
            >
              <Text style={{ color: COLORS.muted, fontWeight: "600" }}>
                Back
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 3 }),
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#FFF",
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", marginTop: 4 },

  imagePicker: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "center",
  },
  imagePickerText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  imageHint: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
  },

  button: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Dropdown styles
  dropdownWrapper: {
    marginBottom: 4,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownText: {
    fontSize: 15,
    color: COLORS.text,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: COLORS.muted,
  },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
});
