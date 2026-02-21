import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import figmaPlugin from "@figma/eslint-plugin-figma-plugins";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@figma/figma-plugins": figmaPlugin,
    },
    rules: {
      ...figmaPlugin.configs.recommended.rules,
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/", "build.mjs"],
  }
);
