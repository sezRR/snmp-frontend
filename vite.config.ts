import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import path from "path"
import { defineConfig, loadEnv } from "vite"

import { mockSnmpApi } from "./dev/mock-snmp-api"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  // Same defaulting the client does, so the mock is mounted where the bundle
  // will look for it.
  const apiPrefix = env.VITE_API_PREFIX ?? "/api"
  // A real backend is configured: every request leaves this origin, and the
  // mock would never be consulted.
  const useMock = !env.VITE_API_BASE_URL

  if (useMock && !apiPrefix) {
    // Mounting the mock at "/" would answer /machines with JSON before the SPA
    // fallback ever saw it, so this is refused rather than half-worked.
    throw new Error(
      "The mock API needs a non-empty VITE_API_PREFIX (use /api), or set VITE_API_BASE_URL to reach a real backend."
    )
  }

  return {
    plugins: [
      useMock && mockSnmpApi({ prefix: apiPrefix }),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
      babel({
        presets: [reactCompilerPreset()],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
