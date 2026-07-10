const { withAndroidManifest } = require("@expo/config-plugins");

// Expo's app.config.js has no top-level `android.allowBackup` field, so we
// set android:allowBackup="false" on <application> directly. Without this,
// Android Auto Backup restores AsyncStorage (and the saved auth token) on
// reinstall, silently logging the user back into their old account.
const withDisableAndroidBackup = (config) =>
  withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application.$["android:allowBackup"] = "false";
    return config;
  });

module.exports = withDisableAndroidBackup;
