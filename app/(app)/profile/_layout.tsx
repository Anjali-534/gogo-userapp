import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="help" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="refer" />
      <Stack.Screen name="safety" />
      <Stack.Screen name="inbox" />
      <Stack.Screen name="family" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="drive" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="promos" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/community" />
      <Stack.Screen name="legal/cookies" />
      <Stack.Screen name="legal/licenses" />
    </Stack>
  );
}
