// app/HomeScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { fetchCurrentUser, api, clearToken } from "../src/api/client";

type Me = { id: number; username: string; role?: string };

const COLORS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  primary: "#F97316", // orange
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

export default function HomeScreen() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const isManager = (me?.role || "").toLowerCase() === "manager";

  async function load() {
    try {
      const user = await fetchCurrentUser();
      setMe(user);

      const { data } = await api.get("/notifications");
      const unread = (data as any[]).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.log("home error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const logout = async () => {
    await clearToken();
    router.replace("/login");
  };

  if (loading || !me) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 8, color: COLORS.muted }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER BAR */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi, {me.username}</Text>
            <View style={styles.roleRow}>
              <Text style={styles.roleText}>
                {isManager ? "Manager" : "Cook"}
              </Text>
              <View style={styles.dot} />
              <Text style={styles.roleSub}>Fogon IMS</Text>
            </View>
          </View>

          <View style={styles.topRight}>
            <TouchableOpacity
              style={styles.iconCircleLight}
              onPress={() => router.push("/notifications")}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={COLORS.primary}
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconCircleDark} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ORANGE BAR + SUBTITLE */}
        <View style={styles.headerAccentRow}>
          <View style={styles.orangeBar} />
          <View>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitle}>
              Manage your inventory and requests.
            </Text>
          </View>
        </View>

        {/* GRID OF ACTIONS */}
        <View style={styles.grid}>
          <MenuCard
            icon="cube-outline"
            label="Inventory"
            caption="View and manage all items"
            onPress={() => router.push("/inventory")}
          />

          <MenuCard
            icon="list-outline"
            label={isManager ? "Review Requests" : "My Requests"}
            caption={
              isManager
                ? "Approve or deny stock requests"
                : "Track your submitted requests"
            }
            onPress={() => router.push("/requests")}
          />

          {!isManager && (
            <MenuCard
              icon="add-circle-outline"
              label="Request Product"
              caption="Ask manager to add stock"
              onPress={() => router.push("/request")}
            />
          )}

          {isManager && (
            <>
              <MenuCard
                icon="add-outline"
                label="Add Product"
                caption="Create new inventory items"
                onPress={() => router.push("/addProduct")}
              />

              <MenuCard
                icon="bar-chart-outline"
                label="Reports"
                caption="View usage and low stock"
                onPress={() => router.push("/reports")}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuCard({
  icon,
  label,
  caption,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardIconCircle}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardCaption}>{caption}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === "ios" ? 10 : 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  // HEADER
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  roleText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.muted,
    marginHorizontal: 6,
  },
  roleSub: {
    fontSize: 14,
    color: COLORS.muted,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircleLight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  iconCircleDark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },

  // SECTION HEADER
  headerAccentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  orangeBar: {
    width: 5,
    height: 40,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },

  // GRID
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  card: {
    width: "47%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardLabel: {
    fontWeight: "600",
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 3,
  },
  cardCaption: {
    fontSize: 12,
    color: COLORS.muted,
  },
});
