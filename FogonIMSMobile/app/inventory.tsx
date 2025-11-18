// app/inventory.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  api,
  loadToken,
  clearToken,
  fetchCurrentUser,
} from "../src/api/client";
import { router } from "expo-router";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
  image_url?: string | null;
  reorder_threshold?: number;
  is_low_stock?: boolean;
};

type Me = { id: number; username: string; role?: string };

type NotificationItem = {
  id: number;
  is_read: boolean;
};

const COLORS = {
  bg: "#F7F8FA",
  card: "#ffffff",
  primary: "#F97316",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

const iosShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
};

export default function Inventory() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const isManager = (me?.role || "").toLowerCase() === "manager";

  async function loadAll() {
    try {
      setLoading(true);

      const [productsRes, user, notifRes] = await Promise.all([
        api.get<Product[]>("/products"),
        fetchCurrentUser(),
        api
          .get<NotificationItem[]>("/notifications")
          .catch(() => ({ data: [] as NotificationItem[] })),
      ]);

      setItems(productsRes.data || []);
      setMe(user);

      const unread = (notifRes.data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err: any) {
      console.log("❌ load error", err?.response?.data || err);
      Alert.alert("Error", "Failed to load inventory or user info.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const tk = await loadToken();
      console.log("🔑 token:", tk ? tk.slice(0, 16) + "..." : "NONE");
      await loadAll();
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  async function logout() {
    await clearToken();
    router.replace("/login");
  }

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
      await loadAll();
    }
  };

  const renderItem = ({ item }: { item: Product }) => {
    const lowStock =
      !!item.is_low_stock ||
      ((item.reorder_threshold ?? 0) > 0 &&
        item.quantity <= (item.reorder_threshold ?? 0)) ||
      item.quantity < 2; // hard rule

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.name}>{item.name}</Text>
              {lowStock && <Text style={styles.lowStockPill}>Low stock</Text>}
            </View>

            <Text style={[styles.meta, lowStock && styles.metaLow]}>
              Qty: {item.quantity} · ${item.price.toFixed(2)}
            </Text>

            {item.description ? (
              <Text style={styles.desc}>{item.description}</Text>
            ) : null}

            {!!item.image_url && (
              <Image
                source={{ uri: absoluteUrl(item.image_url) }}
                style={styles.thumb}
              />
            )}
          </View>

          {isManager && (
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "editProduct",
                    params: { id: String(item.id) },
                  } as any)
                }
                style={[styles.iconBtn, { backgroundColor: "#111827" }]}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={[styles.iconBtn, { backgroundColor: COLORS.primary }]}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          {me?.username && (
            <Text style={styles.subtitle}>
              {me.username} · {isManager ? "Manager" : "Cook"}
            </Text>
          )}
        </View>

        <View style={styles.headerButtons}>
          {isManager && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/requests")}
            >
              <Ionicons name="clipboard-outline" size={18} color="#EA580C" />
              <Text style={styles.secondaryText}>Requests</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.iconCircle}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={COLORS.text}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ACTION ROW */}
      <View style={styles.actionRow}>
        {isManager ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/addProduct")}
          >
            <Ionicons name="add-outline" size={20} color="#fff" />
            <Text style={styles.primaryText}>Add Product</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1, marginRight: 6 }]}
              onPress={() => router.push("/request")}
            >
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>Request Product</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryWideBtn}
              onPress={() => router.push("/requests")}
            >
              <Ionicons name="list-outline" size={18} color="#EA580C" />
              <Text style={styles.secondaryText}>My Requests</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* LIST */}
      {loading && items.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 6, opacity: 0.6 }}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#aaa" />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  subtitle: { color: COLORS.muted, marginTop: 2 },

  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFEDD5",
    gap: 4,
  },
  secondaryWideBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFEDD5",
    gap: 4,
    flex: 1,
    marginLeft: 6,
  },
  secondaryText: {
    color: "#EA580C",
    fontWeight: "600",
    fontSize: 13,
  },

  iconCircle: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    position: "relative",
  },

  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  logoutBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },

  actionRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 3 }),
  },

  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 60, alignItems: "center" },
  emptyText: { marginTop: 8, color: COLORS.muted },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: "600", color: COLORS.text },

  meta: { marginTop: 4, color: "#4B5563", fontSize: 14 },
  metaLow: { color: "#B91C1C", fontWeight: "700" }, // 🔴 Qty line

  desc: { marginTop: 4, color: COLORS.muted, fontSize: 13 },

  lowStockPill: {
    marginLeft: 8,
    backgroundColor: "#FCA5A5", // light red
    color: "#7F1D1D",           // dark red
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontWeight: "700",
  },

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
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
});
