import js from "@eslint/js"
import pluginQuery from "@tanstack/eslint-plugin-query"
import reactHooks from "eslint-plugin-react-hooks"
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores(["dist", "src/routeTree.gen.ts", ".tanstack"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      ...pluginQuery.configs["flat/recommended-strict"],
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactYouMightNotNeedAnEffect.configs.strict,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["src/components/ui/calendar.tsx"],
    rules: {
      "react-you-might-not-need-an-effect/no-event-handler": "off",
    },
  },
])
