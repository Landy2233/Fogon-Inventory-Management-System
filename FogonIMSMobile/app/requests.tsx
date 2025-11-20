// app/requests.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api, fetchCurrentUser } from "../src/api/client";
import { router } from "expo-router";

type StockRequest = {
  id: number;
  product_id: number;
  product_name?: string | null;
  requested_qty: number;
  status: "Pending" | "Approved" | "Denied";
  created_at: string | null;
  // NEW: who requested it (from backend requested_by_name)
  requested_by_name?: string | null;
};

type Me = { id: number; username: string; role?: string };

const COLORS = {
  bg: "#F7F8FA",
  card: "#ffffff",
  primary: "#F97316",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

export default function RequestsScreen() {
  const [items, setItems] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  const isManager = (me?.role || "").toLowerCase() === "manager";

  async function loadUser() {
    try {
      const user = await fetchCurrentUser();
      setMe(user);
    } catch (err: any) {
      console.log("❌ me error", err?.response?.data || err);
    }
  }

  async function loadRequests() {
    try {
      setLoading(true);
      const { data } = await api.get<StockRequest[]>("/requests");
      setItems(data || []);
    } catch (err: any) {
      console.log("❌ load error", err?.response?.data || err);
      Alert.alert("Error", "Failed to load stock requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  async function approve(id: number) {
    try {
      await api.post(`/requests/${id}/approve`);
      await loadRequests();
    } catch (err: any) {
      console.log("❌ approve error", err?.response?.data || err);
      Alert.alert("Error", "Failed to approve request.");
    }
  }

  async function deny(id: number) {
    Alert.alert("Deny Request", "Are you sure you want to deny this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deny",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post(`/requests/${id}/deny`, { reason: "" });
            await loadRequests();
          } catch (err: any) {
            console.log("❌ deny error", err?.response?.data || err);
            Alert.alert("Error", "Failed to deny request.");
          }
        },
      },
    ]);
  }

  // --- cook edit/delete helpers ---
  function handleEdit(item: StockRequest) {
    router.push({
      pathname: "/request",
      params: {
        requestId: String(item.id),
        productId: String(item.product_id),
        qty: String(item.requested_qty),
      },
    });
  }

  function deleteRequest(id: number) {
    Alert.alert(
      "Delete Request",
      "Are you sure you want to delete this request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/requests/${id}`);
              await loadRequests();
            } catch (err: any) {
              console.log("❌ delete error", err?.response?.data || err);
              Alert.alert("Error", "Failed to delete request.");
            }
          },
        },
      ]
    );
  }

  const renderItem = ({ item }: { item: StockRequest }) => (
    <View style={styles.card}>
      <Text style={styles.productName}>
        {item.product_name || "Unknown product"}
      </Text>

      <Text style={styles.detail}>Requested: {item.requested_qty}</Text>

      {/* NEW: show who requested it, only for manager view */}
      {isManager && (
        <Text style={styles.detail}>
          Requested by:{" "}
          {item.requested_by_name && item.requested_by_name.trim().length > 0
            ? item.requested_by_name
            : "Unknown"}
        </Text>
      )}

      {item.created_at && (
        <Text style={styles.meta}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      )}

      <Text
        style={[
          styles.statusChip,
          item.status === "Approved"
            ? styles.statusApproved
            : item.status === "Denied"
            ? styles.statusDenied
            : styles.statusPending,
        ]}
      >
        {item.status}
      </Text>

      {/* Manager actions: approve / deny */}
      {isManager && item.status === "Pending" && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#16A34A" }]}
            onPress={() => approve(item.id)}
          >
            <Text style={styles.actionText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => deny(item.id)}
          >
            <Text style={styles.actionText}>Deny</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cook actions: edit / delete for pending */}
      {!isManager && item.status === "Pending" && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: "#E5E7EB" }, // light gray
            ]}
            onPress={() => handleEdit(item)}
          >
            <Text
              style={[
                styles.actionText,
                { color: "#111827" }, // dark text on gray
              ]}
            >
              Edit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#DC2626" }]} // red
            onPress={() => deleteRequest(item.id)}
          >
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isManager ? "Stock Requests" : "My Stock Requests"}
        </Text>
        <TouchableOpacity onPress={loadRequests}>
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 8, color: COLORS.muted }}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadRequests} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>No stock requests</Text>
            </View>
          }
        />
      )}
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

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { marginTop: 8, color: COLORS.muted },

  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 14,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  detail: { fontSize: 14, color: "#374151" },
  meta: { marginTop: 4, fontSize: 12, color: COLORS.muted },

  statusChip: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "600",
    fontSize: 12,
    alignSelf: "flex-start",
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  statusApproved: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
  },
  statusDenied: {
    backgroundColor: "#FECACA",
    color: "#991B1B",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  actionText: {
    color: "#fff",
    fontWeight: "600",
  },
});
