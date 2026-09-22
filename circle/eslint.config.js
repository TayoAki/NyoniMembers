// The Expo app lints itself: the repository root runs eslint-config-next, which knows nothing
// about React Native, so it ignores this directory entirely.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // An HTML rule with no meaning here: React Native has no markup to escape into, and the
      // house's copy is full of apostrophes that read worse as entities.
      "react/no-unescaped-entities": "off",
    },
  },
  { ignores: ["dist/**", ".expo/**", "expo-env.d.ts"] },
]);
