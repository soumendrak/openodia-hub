import { defineConfig } from "eslint/config";
import { ownedTypes } from "./owned-types-main-rule.ts";

export default defineConfig({
  files: ["**/*.ts", "**/*.tsx"],
  plugins: { main: { rules: { "owned-types": ownedTypes } } },
});
