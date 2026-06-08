import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth";
import { api } from "../api";

interface ItemType {
  id: number;
  labelMy: string;
  emoji: string | null;
  sellable: boolean;
}

const ACTIONS = [
  { key: "sell", label: "ရောင်းမယ်", color: "#059669" },
  { key: "receive", label: "ငွေလက်ခံ", color: "#d97706" },
  { key: "debts", label: "အကြွေး", color: "#7c3aed" },
  { key: "stock", label: "ပစ္စည်း", color: "#475569" },
];

export function HomeScreen() {
  const { user, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [cachedCount, setCachedCount] = useState<number | null>(null);

  async function syncCatalog() {
    setSyncing(true);
    try {
      const types = await api.get<ItemType[]>("/item-types");
      await AsyncStorage.setItem("lgy.types", JSON.stringify(types));
      setCachedCount(types.length);
      Alert.alert("Synced ✓", `${types.length} item types cached for offline.`);
    } catch (e) {
      // Offline? fall back to whatever we cached before.
      const cached = await AsyncStorage.getItem("lgy.types");
      const n = cached ? (JSON.parse(cached) as ItemType[]).length : 0;
      setCachedCount(n);
      Alert.alert("Offline", `Couldn't reach the server. ${n} item types cached locally.`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hi}>{user?.displayName}</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[styles.tile, { backgroundColor: a.color }]}
            onPress={() => Alert.alert(a.label, "Coming next — building screen by screen.")}
          >
            <Text style={styles.tileText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.syncBtn} onPress={syncCatalog} disabled={syncing}>
        <Text style={styles.syncText}>{syncing ? "Syncing…" : "↺ Sync catalog (offline test)"}</Text>
      </TouchableOpacity>
      {cachedCount !== null && (
        <Text style={styles.cached}>{cachedCount} item types cached locally</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hi: { fontSize: 22, fontWeight: "800" },
  logout: { color: "#dc2626", fontSize: 16, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  syncBtn: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#059669",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  syncText: { color: "#059669", fontSize: 16, fontWeight: "700" },
  cached: { textAlign: "center", color: "#6b7280" },
});
