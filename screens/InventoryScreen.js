import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Button,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import api from "../api/client";

export default function InventoryScreen({ navigation, role, onLogout }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data);
    } catch (e) {
      Alert.alert("Error", "Failed to load products.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
  }, []);

  const Header = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Inventory</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {role === "manager" ? (
          <Button title="Add Product" onPress={() => navigation.navigate("AddProduct", { onAdded: loadProducts })} />
        ) : null}
        <Button title="Logout" color="#a00" onPress={onLogout} />
      </View>
    </View>
  );

  const Item = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        marginHorizontal: 16,
        marginVertical: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
      <Text style={{ marginTop: 4 }}>Qty: {item.quantity}</Text>
      <Text>Price: ${Number(item.price || 0).toFixed(2)}</Text>
      {item.description ? <Text style={{ marginTop: 6, opacity: 0.7 }}>{item.description}</Text> : null}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading products…</Text>
      </View>
    );
  }

  return (
    <FlatList
      ListHeaderComponent={<Header />}
      data={products}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <Item item={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 30 }}
    />
  );
}
