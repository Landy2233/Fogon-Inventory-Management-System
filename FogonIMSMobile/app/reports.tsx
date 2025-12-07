// app/reports.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "../src/api/client";
import { LineChart } from "react-native-chart-kit";

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  primary: "#F97316",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  danger: "#DC2626",
};

const SCREEN_WIDTH = Dimensions.get("window").width;

type Summary = {
  total_products: number;
  low_stock_count: number;
  inventory_value: number;
};

type UsageItem = {
  product_id: number;
  product_name: string;
  total_requested: number;
  total_cost: number;
};

type CostPoint = {
  label: string; // e.g. "11/17"
  total_cost: number;
};

type BreakdownRow = {
  category: string | null;
  total_cost: number;
};

type CostAnalysisResponse = {
  range: string;
  points: CostPoint[];
  breakdown: BreakdownRow[];
};

export default function Reports() {
  const [range, setRange] = useState<"weekly" | "monthly">("monthly");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [usageItems, setUsageItems] = useState<UsageItem[]>([]);
  const [costPoints, setCostPoints] = useState<CostPoint[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const formatCurrency = (v: number) =>
    `$${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1) REQUIRED: summary + usage
      const [sRes, uRes] = await Promise.all([
        api.get<Summary>(`/reports/summary?range=${range}`),
        api.get<{ range: string; items: UsageItem[] }>(
          `/reports/usage?range=${range}`
        ),
      ]);

      setSummary(sRes.data);
      setUsageItems(uRes.data.items || []);

      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes().toString().padStart(2, "0");
      const hour12 = ((hh + 11) % 12) + 1;
      const ampm = hh >= 12 ? "PM" : "AM";
      setLastUpdated(`${hour12}:${mm} ${ampm}`);
      setSelectedIndex(null);
    } catch (e: any) {
      console.log("❌ summary/usage load error", e?.response?.data || e);
      setError("Failed to load reports.");
      setLoading(false);
      return; // don’t try cost if the basics failed
    }

    // 2) OPTIONAL: cost analysis (don’t block the whole screen if it fails)
    try {
      const cRes = await api.get<CostAnalysisResponse>(
        `/reports/cost-analysis?range=${range}`
      );
      setCostPoints(cRes.data.points || []);
      setBreakdown(cRes.data.breakdown || []);
    } catch (e: any) {
      console.log("⚠️ cost analysis load error", e?.response?.data || e);
      // Leave chart & breakdown empty; no user-facing error
      setCostPoints([]);
      setBreakdown([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [range]);

  const chartPoints: CostPoint[] = useMemo(() => {
    if (!costPoints || costPoints.length === 0) return [];
    return costPoints;
  }, [costPoints]);

  const selectedPoint: CostPoint | null = useMemo(() => {
    if (!chartPoints.length) return null;
    const idx =
      selectedIndex != null
        ? Math.min(Math.max(selectedIndex, 0), chartPoints.length - 1)
        : chartPoints.length - 1;
    return chartPoints[idx];
  }, [selectedIndex, chartPoints]);

  const chartData = useMemo(() => {
    const labels = chartPoints.map((p) => p.label);
    const data = chartPoints.map((p) => p.total_cost || 0);
    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [chartPoints]);

  const maxCost = useMemo(
    () =>
      breakdown.reduce(
        (max, row) => Math.max(max, row.total_cost || 0),
        0
      ) || 1,
    [breakdown]
  );

  const handleViewInventory = () => {
    router.push("/inventory");
  };

  const handleViewLowStock = () => {
    router.push({ pathname: "/inventory", params: { filter: "low" } });
  };

  const topItems = usageItems.slice(0, 3);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Reports</Text>

        <View style={styles.headerRight}>
          <View style={styles.rangeToggle}>
            <TouchableOpacity
              style={[
                styles.rangeChip,
                range === "weekly" && styles.rangeChipActive,
              ]}
              onPress={() => setRange("weekly")}
            >
              <Text
                style={[
                  styles.rangeText,
                  range === "weekly" && styles.rangeTextActive,
                ]}
              >
                Weekly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.rangeChip,
                range === "monthly" && styles.rangeChipActive,
              ]}
              onPress={() => setRange("monthly")}
            >
              <Text
                style={[
                  styles.rangeText,
                  range === "monthly" && styles.rangeTextActive,
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={fetchAll}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.updatedRow}>
        <Ionicons name="time-outline" size={14} color={COLORS.muted} />
        <Text style={styles.updatedText}>
          Last updated: {lastUpdated || "--"}
        </Text>
      </View>

      {loading && !summary ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Overview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Overview</Text>
            <Text style={styles.cardSubtitle}>
              High-level snapshot for this {range === "weekly" ? "week" : "month"}.
            </Text>

            <View style={styles.overviewRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.overviewLabel}>Total Products</Text>
                <Text style={styles.overviewValue}>
                  {summary?.total_products ?? 0}
                </Text>
                <TouchableOpacity
                  onPress={handleViewInventory}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>View inventory ›</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.overviewLabel}>Low Stock</Text>
                <Text style={[styles.overviewValue, { color: COLORS.danger }]}>
                  {summary?.low_stock_count ?? 0}
                </Text>
                <TouchableOpacity
                  onPress={handleViewLowStock}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>View low stock ›</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.overviewLabel}>Inventory Value</Text>
              <Text style={styles.inventoryValue}>
                {formatCurrency(summary?.inventory_value ?? 0)}
              </Text>
              <Text style={styles.inventoryCaption}>
                Approx. total cost of all items currently in stock.
              </Text>
            </View>
          </View>

          {/* Top requested items */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Requested Items</Text>
            <Text style={styles.cardSubtitle}>
              Based on approved stock requests this{" "}
              {range === "weekly" ? "week" : "month"}.
            </Text>

            {topItems.length === 0 ? (
              <Text style={styles.emptyText}>No approved requests yet.</Text>
            ) : (
              topItems.map((item, idx) => (
                <View key={item.product_id} style={styles.topItemRow}>
                  <View style={styles.rankCircle}>
                    <Text style={styles.rankText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topItemName}>{item.product_name}</Text>
                    <Text style={styles.topItemMeta}>
                      Requested {item.total_requested} time
                      {item.total_requested !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={styles.topItemAmount}>
                    {formatCurrency(item.total_cost || 0)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Cost Analysis area chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cost Analysis</Text>
            <Text style={styles.cardSubtitle}>
              Estimated spend from approved requests (qty × price) this period.
            </Text>

            {chartPoints.length === 0 ? (
              <Text style={styles.emptyText}>No cost data yet.</Text>
            ) : (
              <>
                <LineChart
                  data={chartData}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  fromZero
                  yAxisLabel="$"
                  yAxisInterval={1}
                  withInnerLines
                  withOuterLines={false}
                  withShadow
                  bezier
                  chartConfig={{
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 2,
                    color: (opacity = 1) =>
                      `rgba(249, 115, 22, ${opacity})`,
                    labelColor: (opacity = 1) =>
                      `rgba(107, 114, 128, ${opacity})`,
                    propsForBackgroundLines: {
                      stroke: "#E5E7EB",
                      strokeDasharray: "4 4",
                    },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#FDBA74",
                    },
                    fillShadowGradient: "#FDBA74",
                    fillShadowGradientOpacity: 0.35,
                  }}
                  style={styles.chart}
                  onDataPointClick={(d) => setSelectedIndex(d.index)}
                />

                <View style={styles.costDetailRow}>
                  <View>
                    <Text style={styles.costDetailDate}>
                      {selectedPoint?.label || "--"}
                    </Text>
                    <Text style={styles.costDetailCaption}>
                      Approved requests on this day
                    </Text>
                  </View>
                  <Text style={styles.costDetailAmount}>
                    {formatCurrency(selectedPoint?.total_cost || 0)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Cost Breakdown by category */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cost Breakdown</Text>
            <Text style={styles.cardSubtitle}>
              Spend by category from approved requests this period.
            </Text>

            {breakdown.length === 0 ? (
              <Text style={styles.emptyText}>No cost data yet.</Text>
            ) : (
              breakdown.map((row, idx) => {
                const label = row.category || "Unspecified";
                const ratio = (row.total_cost || 0) / maxCost;
                return (
                  <View
                    key={`${label}-${idx}`}
                    style={{ marginTop: idx === 0 ? 16 : 12 }}
                  >
                    <Text style={styles.breakdownCategory}>{label}</Text>
                    <Text style={styles.breakdownAmount}>
                      {formatCurrency(row.total_cost || 0)}
                    </Text>
                    <View style={styles.breakdownBarBg}>
                      <View
                        style={[
                          styles.breakdownBarFill,
                          { width: `${Math.max(ratio * 100, 8)}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
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
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rangeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 2,
  },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rangeChipActive: {
    backgroundColor: "#FED7AA",
  },
  rangeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
  },
  rangeTextActive: {
    color: COLORS.primary,
  },
  refreshBtn: {
    padding: 6,
  },
  updatedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 4,
    gap: 4,
  },
  updatedText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(iosShadow as any),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  overviewRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 18,
  },
  overviewLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  linkText: {
    marginTop: 4,
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 13,
  },
  inventoryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 4,
  },
  inventoryCaption: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  emptyText: {
    marginTop: 14,
    color: COLORS.muted,
    fontSize: 13,
  },
  topItemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  rankCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rankText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B45309",
  },
  topItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  topItemMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  topItemAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  chart: {
    marginTop: 12,
    borderRadius: 18,
  },
  costDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  costDetailDate: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  costDetailCaption: {
    fontSize: 12,
    color: COLORS.muted,
  },
  costDetailAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  breakdownCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  breakdownAmount: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 4,
  },
  breakdownBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
});
