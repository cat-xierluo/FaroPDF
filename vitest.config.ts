import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/src-tauri/target/**"],
    globals: true,
    setupFiles: ["src/test/setup.ts"],
  },
});
