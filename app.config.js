const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";

module.exports = ({ config }) => ({
  ...config,
  owner: "anjalidivines-team",
  scheme: "gogoo",
  android: {
    ...config.android,
    googleServicesFile: "./google-services.json",
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: googleMapsKey,
      },
    },
    // Lets tapping a https://bogie.in/r/<code> referral link open the app
    // directly (once bogie.in hosts the required Digital Asset Links
    // verification file — see deep-linking TODO in README).
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "bogie.in", pathPrefix: "/r" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  ios: {
    ...config.ios,
    googleServicesFile: "./GoogleService-Info.plist",
    config: {
      ...config.ios?.config,
      googleMapsApiKey: googleMapsKey,
    },
    infoPlist: {
      ...config.ios?.infoPlist,
      NSContactsUsageDescription: "bogie uses your contacts so you can quickly invite friends to refer them.",
      NSCameraUsageDescription: "bogie uses your camera to scan QR codes and capture support/document photos.",
      NSMicrophoneUsageDescription: "bogie uses your microphone for in-app voice notes during support chats.",
      NSLocationWhenInUseUsageDescription: "bogie uses your location to find nearby drivers and track your ride.",
    },
  },
  plugins: [
    ...(config.plugins || []),
    // Referencing app.plugin.js directly (instead of the bare package name)
    // works around an @expo/config-plugins resolver bug: it finds the
    // package's dist/module/package.json ({"type":"module"}) before the
    // real package root, so plugin resolution fails with a SyntaxError.
    "@react-native-firebase/app/app.plugin.js",
    "@react-native-firebase/crashlytics/app.plugin.js",
    "@react-native-firebase/perf/app.plugin.js",
    "expo-font",
    "./plugins/withDisableAndroidBackup.js",
    "expo-secure-store",
  ],
});