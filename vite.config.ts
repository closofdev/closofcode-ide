import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      "~ui": path.resolve(__dirname, "vendor/ui/src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 4444,
    strictPort: true,
    watch: {
      // Rust build artifacts are locked while compiling and must not be watched.
      ignored: ["**/src-tauri/**"],
    },
  },
  clearScreen: false,
  build: {
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      external: [],
    },
  },
})
