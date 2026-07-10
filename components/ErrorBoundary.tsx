import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("App crash caught by ErrorBoundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.emoji}>😕</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.subtitle}>The app encountered an error.</Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FA", padding: 32 },
  emoji:     { fontSize: 64, marginBottom: 16 },
  title:     { fontSize: 22, fontWeight: "800", color: "#0D0D0D", marginBottom: 8, textAlign: "center" },
  subtitle:  { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 32, lineHeight: 20 },
  btn:       { backgroundColor: "#FF6B2B", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32 },
  btnText:   { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
