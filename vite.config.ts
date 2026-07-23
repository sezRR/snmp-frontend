import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

import { mockSnmpApi } from "./dev/mock-snmp-api"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    mockSnmpApi(),
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
})
