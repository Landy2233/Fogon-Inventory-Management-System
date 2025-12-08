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
import { useLocalSearchParams, router } from "expo-router";
import {
  api,
  loadToken,
  clearToken,
  fetchCurrentUser,
} from "../src/api/client";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  description: string;
  image_url?: string | null;
  reorder_threshold?: number;
  is_low_stock?: boolean;
  vendor_name?: string | null;
  vendor_contact?: string | null;
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

function isLowStockProduct(item: Product): boolean {
  const threshold = item.reorder_threshold ?? 0;
  return (
    !!item.is_low_stock ||
    (threshold > 0 && item.quantity <= threshold) ||
    item.quantity < 2
  );
}

// Build full URL for images using axios baseURL
function absoluteUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const base = (api.defaults.baseURL as string) || "";
  // strip trailing /api or /api/
  const baseForFiles = base.replace(/\/api\/?$/, "");
  return `${baseForFiles}${path}`;
}

export default function Inventory() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const params = useLocalSearchParams<{ filter?: string }>();
  const showLowOnly = (params.filter || "").toLowerCase() === "low";

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
    const lowStock = isLowStockProduct(item);

    const vendorName = item.vendor_name?.trim() || "";
    const vendorContact = item.vendor_contact?.trim() || "";
    const hasVendor = vendorName.length > 0 || vendorContact.length > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {lowStock && <Text style={styles.lowStockPill}>Low</Text>}
            </View>

            <Text style={[styles.meta, lowStock && styles.metaLow]}>
              Qty: {item.quantity} · {formatCurrency(item.price)}
            </Text>

            {item.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            {hasVendor && (
              <View style={{ marginTop: 3 }}>
                {vendorName.length > 0 && (
                  <Text style={styles.vendor} numberOfLines={1}>
                    Vendor: {vendorName}
                  </Text>
                )}
                {vendorContact.length > 0 && (
                  <Text style={styles.vendorContact} numberOfLines={1}>
                    Contact: {vendorContact}
                  </Text>
                )}
              </View>
            )}

            {!!item.image_url && (
              <Image
                source={{ uri: absoluteUrl(item.image_url) }}
                style={styles.thumb}
                resizeMode="contain"
              />
            )}
          </View>

          {isManager && (
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/editProduct",
                    params: { id: String(item.id) },
                  })
                }
                style={[styles.iconBtn, { backgroundColor: "#111827" }]}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={[styles.iconBtn, { backgroundColor: COLORS.primary }]}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const displayedItems = showLowOnly
    ? items.filter((p) => isLowStockProduct(p))
    : items;

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          {/* back to HomeScreen */}
          <TouchableOpacity
            onPress={() => router.replace("/HomeScreen")}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>
              {showLowOnly ? "Low Stock" : "Inventory"}
            </Text>
            {me?.username && (
              <Text style={styles.subtitle}>
                {me.username} · {isManager ? "Manager" : "Cook"}
              </Text>
            )}
          </View>
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
      {loading && displayedItems.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 6, opacity: 0.6 }}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#aaa" />
              <Text style={styles.emptyText}>
                {showLowOnly
                  ? "No items are currently low stock."
                  : "No products yet"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatCurrency(v?: number) {
  const n = typeof v === "number" ? v : 0;
  return `$${n.toFixed(2)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  /* HEADER */
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    paddingRight: 8,
    paddingVertical: 4,
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

  /* ACTION ROW */
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

  /* LIST / GRID */
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  columnWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 60, alignItems: "center" },
  emptyText: { marginTop: 8, color: COLORS.muted },

  /* CARD */
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 10,
    marginTop: 10,
    marginHorizontal: 4,
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
    marginLeft: 6,
    flexDirection: "column",
    gap: 6,
  },
  name: { fontSize: 16, fontWeight: "600", color: COLORS.text },

  meta: { marginTop: 4, color: "#4B5563", fontSize: 13 },
  metaLow: { color: "#B91C1C", fontWeight: "700" },

  desc: { marginTop: 4, color: COLORS.muted, fontSize: 12 },

  vendor: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11,
  },
  vendorContact: {
    marginTop: 1,
    color: "#9CA3AF",
    fontSize: 11,
  },

  lowStockPill: {
    marginLeft: 8,
    backgroundColor: "#FCA5A5",
    color: "#7F1D1D",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    fontWeight: "700",
  },

  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    ...(Platform.OS === "ios" ? iosShadow : { elevation: 2 }),
  },

  thumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#F3F4F6",
  },
});
