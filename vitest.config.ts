import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const configDir = decodeURIComponent(new URL(".", import.meta.url).pathname).replace(/\/$/, "");
const worktreeMarker = "/.claude/worktrees/";
const dependencyRoot = configDir.includes(worktreeMarker)
  ? configDir.slice(0, configDir.indexOf(worktreeMarker))
  : configDir;

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: Array.from(new Set([configDir, dependencyRoot])),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**", "**/src-tauri/target/**"],
    globals: true,
    setupFiles: ["src/test/setup.ts"],
  },
});
