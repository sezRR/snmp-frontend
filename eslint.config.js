import js from "@eslint/js"
import pluginQuery from "@tanstack/eslint-plugin-query"
import reactHooks from "eslint-plugin-react-hooks"
// import reactRefresh from "eslint-plugin-react-refresh"
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      ...pluginQuery.configs["flat/recommended-strict"],
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      //   reactRefresh.configs.vite,
      reactYouMightNotNeedAnEffect.configs.strict,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
