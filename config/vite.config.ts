import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * ISS-QA-02：pdfjs worker 模式解析标准字体需要 `standardFontDataUrl` 指向
 * `pdfjs-dist/standard_fonts/`（16 个 .pfb / .ttf 字体）。Vite 不会把 bare
 * module 目录当资产处理（`new URL("pdfjs-dist/standard_fonts/", import.meta.url)`
 * 打包后解析为 `tauri://localhost/assets/pdfjs-dist/standard_fonts/` → 404），
 * 故在此 plugin 统一提供 `/standard_fonts/`：
 * - dev：`configureServer` 中间件把 `/standard_fonts/*` 映射到 node_modules 真实文件
 * - build：`closeBundle` 把字体复制到 `dist/standard_fonts/`
 * 前端代码 `standardFontDataUrl = "/standard_fonts/"`（根路径，dev/prod 一致）。
 */
function provideStandardFonts(): Plugin {
  const fontsDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../node_modules/.pnpm/pdfjs-dist@6.0.227/node_modules/pdfjs-dist/standard_fonts",
  );
  const distFontsDir = resolve(process.cwd(), "dist/standard_fonts");

  return {
    name: "faropdf:standard-fonts",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/standard_fonts/")) {
          next();
          return;
        }
        const fileName = url.slice("/standard_fonts/".length);
        const filePath = join(fontsDir, fileName);
        // 防目录穿越：只允许 fontsDir 内的文件
        if (!filePath.startsWith(fontsDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader("Content-Type", "font/ttf");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        createReadStream(filePath).pipe(res);
      });
    },
    async closeBundle() {
      if (!existsSync(fontsDir)) return;
      mkdirSync(distFontsDir, { recursive: true });
      for (const fileName of readdirSync(fontsDir)) {
        const src = join(fontsDir, fileName);
        if (statSync(src).isFile()) {
          cpSync(src, join(distFontsDir, fileName));
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), provideStandardFonts()],

  // 构建戳：每次 vite build 生成新时间戳，前端启动时 console 打出
  // 「[FaroPDF] frontend build: …」——用于真机 devtools 一眼确认
  // 打包产物嵌的是哪版前端（tauri 资产嵌入是压缩的，静态 grep 不可靠；
  // 2026-08-14 QA-02 第 3 版真机排查时定位「产物嵌入新旧不明」用）。
  define: {
    __FAROPDF_BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
