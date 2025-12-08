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

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_VALUES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

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
  month?: string | null;
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

  // Month/year dropdown state
  const now = new Date();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(
    now.getMonth() // 0–11
  );
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [showYearMenu, setShowYearMenu] = useState(false);

  // Years to show in dropdown (you can extend this if you’ll have more history)
  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return [current, current - 1, current - 2];
  }, [now]);

  const selectedMonthLabel = `${MONTH_LABELS[selectedMonthIndex]} ${selectedYear}`;

  const formatCurrency = (v: number) =>
    `$${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  const periodLabel =
    range === "weekly" ? "this week" : selectedMonthLabel;

  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    // Decide query mode:
    // - Weekly: use ?range=weekly
    // - Monthly: use ?month=YYYY-MM based on dropdown
    let queryParam: string;
    if (range === "weekly") {
      queryParam = "range=weekly";
    } else {
      const monthValue = MONTH_VALUES[selectedMonthIndex]; // "01".."12"
      queryParam = `month=${selectedYear}-${monthValue}`;
    }

    try {
      // Summary = snapshot of current inventory (no range/month needed)
      const [sRes, uRes] = await Promise.all([
        api.get<Summary>("/reports/summary"),
        api.get<{ range: string; month?: string | null; items: UsageItem[] }>(
          `/reports/usage?${queryParam}`
        ),
      ]);

      setSummary(sRes.data);
      setUsageItems(uRes.data.items || []);

      const nowTime = new Date();
      const hh = nowTime.getHours();
      const mm = nowTime.getMinutes().toString().padStart(2, "0");
      const hour12 = ((hh + 11) % 12) + 1;
      const ampm = hh >= 12 ? "PM" : "AM";
      setLastUpdated(`${hour12}:${mm} ${ampm}`);
      setSelectedIndex(null);
    } catch (e: any) {
      console.log("❌ summary/usage load error", e?.response?.data || e);
      setError("Failed to load reports.");
      setLoading(false);
      return;
    }

    // Cost analysis (optional)
    try {
      const cRes = await api.get<CostAnalysisResponse>(
        `/reports/cost-analysis?${queryParam}`
      );
      setCostPoints(cRes.data.points || []);
      setBreakdown(cRes.data.breakdown || []);
    } catch (e: any) {
      console.log("⚠️ cost analysis load error", e?.response?.data || e);
      setCostPoints([]);
      setBreakdown([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [range, selectedMonthIndex, selectedYear]);

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

  const clearDropdownMenus = () => {
    setShowMonthMenu(false);
    setShowYearMenu(false);
  };

  const handleRangeChange = (newRange: "weekly" | "monthly") => {
    clearDropdownMenus();
    setRange(newRange);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            clearDropdownMenus();
            router.back();
          }}
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
              onPress={() => handleRangeChange("weekly")}
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
              onPress={() => handleRangeChange("monthly")}
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
            onPress={() => {
              clearDropdownMenus();
              fetchAll();
            }}
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

      {/* Month/Year dropdowns – ONLY when Monthly is selected */}
      {range === "monthly" && (
        <View style={styles.dropdownRow}>
          {/* Month dropdown */}
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.dropdownLabel}>Month</Text>
            <TouchableOpacity
              style={styles.dropdownBox}
              activeOpacity={0.8}
              onPress={() => {
                setShowMonthMenu((prev) => !prev);
                setShowYearMenu(false);
              }}
            >
              <Text style={styles.dropdownValue}>
                {MONTH_LABELS[selectedMonthIndex]}
              </Text>
              <Ionicons
                name={showMonthMenu ? "chevron-up" : "chevron-down"}
                size={16}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {showMonthMenu && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={{ maxHeight: 200 }}>
                  {MONTH_LABELS.map((label, idx) => {
                    const active = idx === selectedMonthIndex;
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.dropdownItem,
                          active && styles.dropdownItemActive,
                        ]}
                        onPress={() => {
                          setSelectedMonthIndex(idx);
                          setShowMonthMenu(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            active && styles.dropdownItemTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Year dropdown */}
          <View style={{ width: 110 }}>
            <Text style={styles.dropdownLabel}>Year</Text>
            <TouchableOpacity
              style={styles.dropdownBox}
              activeOpacity={0.8}
              onPress={() => {
                setShowYearMenu((prev) => !prev);
                setShowMonthMenu(false);
              }}
            >
              <Text style={styles.dropdownValue}>{selectedYear}</Text>
              <Ionicons
                name={showYearMenu ? "chevron-up" : "chevron-down"}
                size={16}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {showYearMenu && (
              <View style={styles.dropdownMenu}>
                {yearOptions.map((year) => {
                  const active = year === selectedYear;
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.dropdownItem,
                        active && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedYear(year);
                        setShowYearMenu(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          active && styles.dropdownItemTextActive,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

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
              High-level snapshot of your current inventory.
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
              Based on approved stock requests for{" "}
              {range === "weekly" ? "this week" : selectedMonthLabel}.
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
              Estimated spend from approved requests (qty × price) for{" "}
              {range === "weekly" ? "this week" : selectedMonthLabel}.
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
              Spend by category from approved requests for{" "}
              {range === "weekly" ? "this week" : selectedMonthLabel}.
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
    gap: 6,
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

  // Dropdown styles
  dropdownRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 4,
    marginTop: 4,
  },
  dropdownLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
    fontWeight: "600",
  },
  dropdownBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  dropdownValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  dropdownMenu: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(iosShadow as any),
    zIndex: 20,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownItemActive: {
    backgroundColor: "#FEF3C7",
  },
  dropdownItemText: {
    fontSize: 13,
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    fontWeight: "700",
    color: "#92400E",
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
