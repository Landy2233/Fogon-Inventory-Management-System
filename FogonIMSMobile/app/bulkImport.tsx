// app/bulkImport.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api/client";
import { router } from "expo-router";

const COLORS = {
  bg: "#F7F8FA",
  card: "#ffffff",
  primary: "#F97316",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

type Row = {
  name: string;
  quantity: string;
  price: string;
  description: string;
  reorder_threshold: string;
  vendor_name: string;
  vendor_contact: string;
};

export default function BulkImportScreen() {
  const [rows, setRows] = useState<Row[]>([
    emptyRow(),
    emptyRow(),
    emptyRow(),
  ]);
  const [saving, setSaving] = useState(false);

  function emptyRow(): Row {
    return {
      name: "",
      quantity: "0",
      price: "0.00",
      description: "",
      reorder_threshold: "0",
      vendor_name: "",
      vendor_contact: "",
    };
  }

  const updateRow = (index: number, field: keyof Row, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    const items = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        quantity: Number(r.quantity || 0),
        price: Number(r.price || 0),
        description: r.description.trim(),
        reorder_threshold: Number(r.reorder_threshold || 0),
        vendor_name: r.vendor_name.trim(),
        vendor_contact: r.vendor_contact.trim(),
      }));

    if (!items.length) {
      Alert.alert("Nothing to import", "Please fill at least one product name.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post("/products/bulk", { items });
      Alert.alert(
        "Bulk Import Complete",
        `Imported ${data.count} product(s) successfully.`
      );
      router.replace("/inventory");
    } catch (err: any) {
      console.log("bulk error", err?.response?.data || err);
      Alert.alert(
        "Error",
        err?.response?.data?.error || "Failed to import products."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Bulk Import Products</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Add multiple products at once. Only rows with a name will be imported.
        </Text>

        {rows.map((row, idx) => (
          <View key={idx} style={styles.rowCard}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>Product #{idx + 1}</Text>
              {rows.length > 1 && (
                <TouchableOpacity onPress={() => removeRow(idx)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Name* (e.g., Avocado)"
              value={row.name}
              onChangeText={(t) => updateRow(idx, "name", t)}
            />

            <View style={styles.inline}>
              <TextInput
                style={[styles.input, styles.inlineField]}
                placeholder="Qty"
                keyboardType="numeric"
                value={row.quantity}
                onChangeText={(t) => updateRow(idx, "quantity", t)}
              />
              <TextInput
                style={[styles.input, styles.inlineField]}
                placeholder="Price"
                keyboardType="decimal-pad"
                value={row.price}
                onChangeText={(t) => updateRow(idx, "price", t)}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Reorder threshold (e.g., 2)"
              keyboardType="numeric"
              value={row.reorder_threshold}
              onChangeText={(t) => updateRow(idx, "reorder_threshold", t)}
            />

            <TextInput
              style={styles.input}
              placeholder="Vendor name (optional)"
              value={row.vendor_name}
              onChangeText={(t) => updateRow(idx, "vendor_name", t)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vendor contact (phone/email)"
              value={row.vendor_contact}
              onChangeText={(t) => updateRow(idx, "vendor_contact", t)}
            />

            <TextInput
              style={[styles.input, { height: 60 }]}
              multiline
              placeholder="Description (optional)"
              value={row.description}
              onChangeText={(t) => updateRow(idx, "description", t)}
            />
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addRow}>
          <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
          <Text style={styles.addText}>Add another row</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.7 }]}
          onPress={submit}
          disabled={saving}
        >
          <Text style={styles.submitText}>
            {saving ? "Importing..." : "Submit Bulk Import"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  subtitle: { color: COLORS.muted, marginBottom: 12 },
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  rowTitle: { fontWeight: "600", color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginTop: 6,
  },
  inline: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  inlineField: { flex: 1 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  addText: {
    marginLeft: 6,
    color: COLORS.primary,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
