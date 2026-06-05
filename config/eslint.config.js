import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// eslint config 位于 config/ 子目录；projectRoot 是 config/ 的父目录（项目根）
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist", ".claude", "src-tauri/target"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        // tsconfig.json 收束在 config/，project service 从 linted 文件向上 walk 找不到；
        // 显式列出两个 tsconfig 路径，避免依赖 walk-up 解析。
        project: ["./config/tsconfig.json", "./config/tsconfig.node.json"],
        tsconfigRootDir: projectRoot,
      },
    },
  },
);
