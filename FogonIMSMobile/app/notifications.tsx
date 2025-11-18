// app/notifications.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { api } from "../src/api/client";
import { router } from "expo-router";

type NotificationItem = {
  id: number;
  type: "LOW_STOCK" | "REQUEST_APPROVED" | "REQUEST_DENIED";
  message: string;
  is_read: boolean;
  created_at: string | null;
};

const COLORS = {
  bg: "#f4f5f9",
  card: "#ffffff",
  primary: "#f97316",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      // hits: GET /api/notifications
      const { data } = await api.get<NotificationItem[]>("/notifications");
      setItems(data);
    } catch (e: any) {
      console.error(e?.response?.data || e);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number) {
    try {
      // hits: POST /api/notifications/:id/read
      await api.post(`/notifications/${id}/read`);
      await load();
    } catch (e: any) {
      console.error(e?.response?.data || e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.card,
        !item.is_read && { borderColor: COLORS.primary, borderWidth: 1 },
      ]}
      onPress={() => markRead(item.id)}
    >
      <Text style={styles.message}>{item.message}</Text>
      {item.created_at && (
        <Text style={styles.meta}>
          {item.type} • {new Date(item.created_at).toLocaleString()}
        </Text>
      )}
      {!item.is_read && (
        <Text style={styles.unread}>Tap to mark as read</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>No notifications</Text>
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  backText: { color: COLORS.primary, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: COLORS.muted },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  message: { fontSize: 15, color: COLORS.text },
  meta: { marginTop: 4, fontSize: 12, color: COLORS.muted },
  unread: { marginTop: 6, fontSize: 12, color: COLORS.primary },
});
