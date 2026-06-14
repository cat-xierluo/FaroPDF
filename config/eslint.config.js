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
    ignores: ["dist", ".claude", ".playwright-mcp", "src-tauri/target"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        // tsconfig.json 收束在 config/，project service 从 linted 文件向上 walk 找不到；
        // 显式列出两个 tsconfig 路径，避免依赖 walk-up 解析。
        project: ["./config/tsconfig.eslint.json", "./config/tsconfig.node.json"],
        tsconfigRootDir: projectRoot,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/fixtures/**/*.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
        // browser globals (audit scripts 在 page.evaluate() 内部用 document / getComputedStyle 等,
        // 这些是浏览器 API, 不是 Node 内置, 但 page.evaluate 字符串内会被 eslint 解析为顶层引用)
        document: "readonly",
        getComputedStyle: "readonly",
        getElementById: "readonly",
        window: "readonly",
        HTMLCanvasElement: "readonly",
        AbortSignal: "readonly",
        DOMException: "readonly",
      },
    },
  },
);
