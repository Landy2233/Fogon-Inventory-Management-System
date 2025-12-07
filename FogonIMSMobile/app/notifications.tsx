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
  RefreshControl,
} from "react-native";
import { api } from "../src/api/client";
import { router } from "expo-router";

type NotificationType =
  | "LOW_STOCK"
  | "REQUEST_APPROVED"
  | "REQUEST_DENIED"
  | "REQUEST_CREATED"
  | string;

type NotificationItem = {
  id: number;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string | null;
};

const COLORS = {
  bg: "#f3f4f6",
  card: "#ffffff",
  primary: "#f97316",
  primarySoft: "#ffedd5",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  unreadDot: "#22c55e",
};

function formatTypeLabel(t: NotificationType): string {
  switch (t) {
    case "LOW_STOCK":
      return "Low stock";
    case "REQUEST_APPROVED":
      return "Request approved";
    case "REQUEST_DENIED":
      return "Request denied";
    case "REQUEST_CREATED":
      return "New request";
    default:
      return String(t || "").replace(/_/g, " ").toLowerCase();
  }
}

function iconForType(t: NotificationType): string {
  switch (t) {
    case "LOW_STOCK":
      return "⚠️";
    case "REQUEST_APPROVED":
      return "✅";
    case "REQUEST_DENIED":
      return "❌";
    case "REQUEST_CREATED":
      return "📝";
    default:
      return "🔔";
  }
}

function sortByNewest(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => {
    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const { data } = await api.get<NotificationItem[]>("/notifications");
      setItems(sortByNewest(data));
    } catch (e: any) {
      console.error(e?.response?.data || e);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number) {
    // Optimistic UI update
    setItems((prev) =>
      sortByNewest(
        prev.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      )
    );

    try {
      await api.post(`/notifications/${id}/read`);
    } catch (e: any) {
      console.error(e?.response?.data || e);
    }
  }

  async function onRefresh() {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUnread = !item.is_read;
    const createdAt = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : "";

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isUnread && styles.cardUnread,
        ]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardRow}>
          {/* Icon bubble */}
          <View style={[styles.iconBubble, isUnread && styles.iconBubbleUnread]}>
            <Text style={styles.iconText}>{iconForType(item.type)}</Text>
          </View>

          {/* Text content */}
          <View style={styles.cardContent}>
            {/* First row: title + unread dot */}
            <View style={styles.cardHeaderRow}>
              <Text
                style={[
                  styles.message,
                  isUnread && styles.messageUnread,
                ]}
                numberOfLines={2}
              >
                {item.message}
              </Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>

            {/* Second row: type badge + time */}
            <View style={styles.metaRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {formatTypeLabel(item.type)}
                </Text>
              </View>
              {!!createdAt && (
                <Text style={styles.metaTime}>{createdAt}</Text>
              )}
            </View>

            {/* Third row: hint for unread */}
            {isUnread && (
              <Text style={styles.unreadHint}>Tap to mark as read</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>All caught up 🎉</Text>
              <Text style={styles.emptyText}>
                You don&apos;t have any notifications right now.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
  headerLeft: { width: 70 },
  headerRight: { width: 70 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  backText: {
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 4,
  },

  // Card styles
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardUnread: {
    borderColor: COLORS.primary,
    backgroundColor: "#fffaf4",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconBubbleUnread: {
    backgroundColor: COLORS.primarySoft,
  },
  iconText: {
    fontSize: 20,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  message: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  messageUnread: {
    fontWeight: "600",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.unreadDot,
    marginLeft: 6,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary,
  },
  metaTime: {
    fontSize: 11,
    color: COLORS.muted,
  },
  unreadHint: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.primary,
  },

  // Empty state
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
  },
});
