// app/addProduct.tsx
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
import { Ionicons } from "@expo/vector-icons";
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

// 🔹 Category options (Option A dropdown)
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

type ProductForm = {
  id: number;
  name: string;
  quantity: string;
  price: string;
  description: string;
  imageUri: string | null;
  vendor_name: string;
  vendor_contact: string;
  category: string; // 👈 new
};

const createEmptyProduct = (id: number): ProductForm => ({
  id,
  name: "",
  quantity: "0",
  price: "0",
  description: "",
  imageUri: null,
  vendor_name: "",
  vendor_contact: "",
  category: "",
});

export default function AddProduct() {
  const [products, setProducts] = useState<ProductForm[]>([
    createEmptyProduct(1),
  ]);
  const [saving, setSaving] = useState(false);
  const [nextId, setNextId] = useState(2);

  // which card's dropdown is open (for Option A)
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  const updateProduct = (index: number, changes: Partial<ProductForm>) => {
    setProducts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...changes };
      return copy;
    });
  };

  const pickImage = async (index: number) => {
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
      updateProduct(index, { imageUri: res.assets[0].uri });
    }
  };

  const addAnotherProduct = () => {
    setProducts((prev) => [...prev, createEmptyProduct(nextId)]);
    setNextId((id) => id + 1);
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => {
      if (prev.length === 1) return prev; // don't remove last one
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const saveAll = async () => {
    // only submit products that have a name
    const toSubmit = products.filter((p) => p.name.trim());

    if (toSubmit.length === 0) {
      Alert.alert(
        "Missing products",
        "Please enter at least one product with a name."
      );
      return;
    }

    // validate numbers
    for (const p of toSubmit) {
      const qty = Number(p.quantity);
      const pr = Number(p.price);
      if (Number.isNaN(qty) || Number.isNaN(pr)) {
        Alert.alert(
          "Invalid values",
          "Quantity and price must be numbers for all products."
        );
        return;
      }
    }

    try {
      setSaving(true);
      const createdIds: number[] = [];

      for (const p of toSubmit) {
        const qty = Number(p.quantity);
        const pr = Number(p.price);

        const form = new FormData();
        form.append("name", p.name.trim());
        form.append("quantity", String(qty));
        form.append("price", String(pr));
        form.append("description", p.description.trim());
        form.append("vendor_name", p.vendor_name.trim());
        form.append("vendor_contact", p.vendor_contact.trim());
        form.append("category", p.category || ""); // 👈 send category

        if (p.imageUri) {
          const filename =
            p.imageUri.split("/").pop() || `photo-${Date.now()}.jpg`;
          const ext = (/\.(\w+)$/i.exec(filename)?.[1] || "jpg").toLowerCase();
          const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
          form.append("image", {
            uri: p.imageUri,
            name: filename,
            type,
          } as any);
        }

        const { data } = await api.post("/products", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        createdIds.push(data.id);
      }

      Alert.alert(
        "✅ Success",
        `Created ${createdIds.length} product${
          createdIds.length > 1 ? "s" : ""
        }`
      );
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

  const renderCategoryLabel = (value: string) => {
    const found = CATEGORY_OPTIONS.find((c) => c.value === value);
    return found ? found.label : "Select category";
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
          <Text style={styles.screenTitle}>Add Products</Text>
          <Text style={styles.screenSubtitle}>
            Create one or multiple items for your inventory.
          </Text>

          {products.map((p, index) => {
            const isOpen = openDropdownId === p.id;
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.title}>Product {index + 1}</Text>
                  {products.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeProduct(index)}
                      style={styles.removeChip}
                    >
                      <Text style={styles.removeChipText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Avocado"
                  placeholderTextColor={COLORS.muted}
                  value={p.name}
                  onChangeText={(text) => updateProduct(index, { name: text })}
                />

                {/* Category dropdown (Option A) */}
                <Text style={styles.label}>Category</Text>
                <View style={styles.dropdownWrapper}>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() =>
                      setOpenDropdownId(isOpen ? null : p.id)
                    }
                    activeOpacity={0.85}
                  >
                    <Text
                      style={
                        p.category
                          ? styles.dropdownText
                          : styles.dropdownPlaceholder
                      }
                    >
                      {renderCategoryLabel(p.category)}
                    </Text>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.dropdownMenu}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={styles.dropdownItem}
                          onPress={() => {
                            updateProduct(index, { category: opt.value });
                            setOpenDropdownId(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              opt.value === p.category && {
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

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={COLORS.muted}
                      keyboardType="numeric"
                      value={p.quantity}
                      onChangeText={(text) =>
                        updateProduct(index, { quantity: text })
                      }
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Price</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.muted}
                      keyboardType="decimal-pad"
                      value={p.price}
                      onChangeText={(text) =>
                        updateProduct(index, { price: text })
                      }
                    />
                  </View>
                </View>

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  placeholder="Brief details about this item..."
                  placeholderTextColor={COLORS.muted}
                  value={p.description}
                  onChangeText={(text) =>
                    updateProduct(index, { description: text })
                  }
                />

                {/* Vendor info */}
                <Text style={styles.label}>Vendor Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Local Supplier"
                  placeholderTextColor={COLORS.muted}
                  value={p.vendor_name}
                  onChangeText={(text) =>
                    updateProduct(index, { vendor_name: text })
                  }
                />

                <Text style={styles.label}>Vendor Contact</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Phone, email, etc."
                  placeholderTextColor={COLORS.muted}
                  value={p.vendor_contact}
                  onChangeText={(text) =>
                    updateProduct(index, { vendor_contact: text })
                  }
                />

                <Text style={styles.label}>Image</Text>
                <View style={styles.imageSection}>
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => pickImage(index)}
                  >
                    <Text style={styles.outlineButtonText}>Pick Image</Text>
                  </TouchableOpacity>
                  {p.imageUri ? (
                    <Image source={{ uri: p.imageUri }} style={styles.preview} />
                  ) : (
                    <Text style={styles.noImageText}>No image selected</Text>
                  )}
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addAnotherButton}
            onPress={addAnotherProduct}
            disabled={saving}
          >
            <Text style={styles.addAnotherText}>+ Add another product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              saving && styles.buttonDisabled,
              { marginTop: 14 },
            ]}
            onPress={saveAll}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? "Saving..." : "Save All Products"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.textButtonText}>Back</Text>
          </TouchableOpacity>
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
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  screenSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
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
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  removeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fee2e2",
  },
  removeChipText: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "600",
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
    height: 80,
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
    marginBottom: 4,
    gap: 8,
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noImageText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  primaryButton: {
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
  addAnotherButton: {
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff7ed",
  },
  addAnotherText: {
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 14,
  },

  // 🔽 Dropdown styles
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
