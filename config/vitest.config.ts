import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const configDir = decodeURIComponent(new URL(".", import.meta.url).pathname).replace(/\/$/, "");
const worktreeMarker = "/.claude/worktrees/";
// Vitest config 位于 config/ 子目录；非 worktree 场景下 projectRoot 是 config/ 的父目录
const projectRoot = configDir.includes(worktreeMarker)
  ? configDir.slice(0, configDir.indexOf(worktreeMarker))
  : configDir.replace(/\/config$/, "");

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: Array.from(new Set([configDir, projectRoot])),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**", "**/src-tauri/target/**"],
    globals: true,
    setupFiles: ["src/test/setup.ts"],
  },
});
