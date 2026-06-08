import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../auth";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>LGY</Text>
      <Text style={styles.sub}>Shop staff</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.btn, busy && styles.disabled]}
        onPress={onSubmit}
        disabled={busy || !username.trim() || !password}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log in</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24, justifyContent: "center" },
  title: { fontSize: 40, fontWeight: "800", textAlign: "center" },
  sub: { fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 32 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    marginTop: 4,
  },
  error: { color: "#dc2626", marginTop: 12 },
  btn: {
    marginTop: 24,
    backgroundColor: "#059669",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 20, fontWeight: "800" },
});
