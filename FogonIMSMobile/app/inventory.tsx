import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { api, clearToken, loadToken } from "../src/api/client";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
  image_url?: string | null;
};

export default function Inventory() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ username?: string; role?: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: products }, { data: user }] = await Promise.all([
        api.get("/products"),
        api.get("/me"),
      ]);
      setItems(Array.isArray(products) ? products : []);
      setMe(user);
    } catch (err: any) {
      console.log("❌ load error", err?.response?.status, err?.response?.data);
      Alert.alert("Error", "Failed to load inventory or user info.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await clearToken();
    router.replace("/login");
  }

  useEffect(() => {
    (async () => {
      const tk = await loadToken();
      console.log("🔑 stored token:", tk ? tk.slice(0, 16) + "..." : "NONE");
      await load();
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const isManager = (me?.username || "").toLowerCase() === "manager";

  const confirmDelete = (product: Product) => {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to delete “${product.name}”?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteProduct(product.id),
        },
      ]
    );
  };

  const deleteProduct = async (id: number) => {
    try {
      setItems((prev) => prev.filter((p) => p.id !== id)); // optimistic
      await api.delete(`/products/${id}`);
    } catch (e: any) {
      Alert.alert(
        "Delete failed",
        e?.response?.data?.error || "Unable to delete product."
      );
      await load();
    }
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text>
            Qty: {item.quantity} {"   "} Price: ${item.price.toFixed(2)}
          </Text>

          {/* Thumbnail if available */}
          {!!item.image_url && (
            <Image
              source={{ uri: absoluteUrl(item.image_url) }}
              style={styles.thumb}
            />
          )}

          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        </View>

        {isManager ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* ✏️ Edit */}
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/editProduct/",
                  params: { id: String(item.id) },
                } as any)
              }
              style={[styles.iconBtn, { backgroundColor: "#374151" }]}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
            </TouchableOpacity>

            {/* 🗑️ Delete */}
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              style={[styles.iconBtn, { backgroundColor: "#dc2626" }]}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push(isManager ? "/addProduct" : "/request")}
          >
            <Ionicons
              name={isManager ? "add-circle-outline" : "paper-plane-outline"}
              size={18}
              color="#fff"
            />
            <Text style={styles.primaryText}>
              {isManager ? "Add Product" : "Request Product"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 6, opacity: 0.6 }}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          onRefresh={load}
          refreshing={loading}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#888" />
              <Text style={styles.emptyText}>No products yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function absoluteUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const BASE = __DEV__ ? "http://127.0.0.1:5001" : "http://192.168.1.3:5001";
  return `${BASE}${path}`;
}

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F7F8FA",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  headerButtons: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  logoutText: { color: "#fff", fontWeight: "600" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  desc: { opacity: 0.7, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyText: { marginTop: 10, fontSize: 16, opacity: 0.6 },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },
});
