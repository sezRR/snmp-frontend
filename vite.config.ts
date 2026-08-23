import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import path from "path"
import { defineConfig, loadEnv } from "vite"

import { mockSnmpApi } from "./dev/mock-snmp-api"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const apiPrefix = env.VITE_API_PREFIX ?? "/api"
  const useMock = !env.VITE_API_BASE_URL

  if (useMock && !apiPrefix) {
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
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "three",
                test: /node_modules[\\/]three[\\/]/,
                priority: 20,
              },
              {
                name: "postprocessing",
                test: /node_modules[\\/]postprocessing[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
  }
})
