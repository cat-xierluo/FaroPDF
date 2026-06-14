# FaroPDF 第 2 阶段排查设计 — 启动验证

> 日期: 2026-06-14
> 状态: 已对齐,执行中
> 前置: `docs/plans/2026-06-14-faropdf-audit-stage-1-report.md`

## 目标

基于第 1 阶段静态报告 §5 必跑清单,实际启动 `pnpm dev` (vite dev server) + macOS 截图 + `mcp__zai-mcp-server__*` 分析,逐项验证 5 个 P0 + 6 个 P1 视觉偏差是否真实可复现,跳出更多运行时上下文。

## 工具链

| 步骤 | 工具 | 用途 |
|------|------|------|
| 1 | Bash + `pnpm dev` 后台 | 启动 vite dev server (port 5173) |
| 2 | Bash + `curl http://localhost:5173` | 验证 server up |
| 3 | Bash + `osascript -e 'tell application "Google Chrome" to ...'` | 驱动 Chrome 打开页面 + 等待渲染 + 截标签页 |
| 4 | `mcp__zai-mcp-server__ui_diff_check` | 期望 UI 截图 vs 实际 UI 截图对比 |
| 5 | `mcp__zai-mcp-server__extract_text_from_screenshot` | 截图 OCR 抽出文字,验证按钮文字 / 状态 |
| 6 | `mcp__zai-mcp-server__analyze_image` | 综合分析截图,识别布局偏差 |
| 7 | `mcp__zai-mcp-server__diagnose_error_screenshot` | 错误截图诊断(若有) |

## 验证场景

### 必跑 P0(5 个)

| 场景 | 报告编号 | 复现方法 |
|------|----------|----------|
| OCR stub 复现 | F-01 / F-10 | 打开示例 PDF → 工具启动器 → 扫描 OCR → 点开始 OCR → 截任务列表状态, OCR 工作台 console |
| 图片转 PDF 缺口 | F-08 | 启动后欢迎页 / 工具启动器 / 设置页 → 截图确认无"图片转 PDF" / "Word 转 PDF" 入口 |
| 压缩效果对比 | F-02 | 准备一份含高分辨率图的 PDF fixture → 走压缩导出 → 截图体积对比(实际需要先有文件,可能用纯代码侧验证降级) |
| 批注图章 SVG | F-03 | 加 5 个图章批注 → 扁平化导出 → 打开导出的 PDF(用浏览器 chrome pdf viewer 或外部工具) |
| 作者卡二维码 | F-04 | 设置 → 关于 → 截图二维码(肉眼判断是否是占位) |

### 必跑 P1 视觉偏差(6 个)

| 场景 | 报告编号 | 复现方法 |
|------|----------|----------|
| 顶栏文字密度 | 2.1.2 | 启动后 1500×900 / 1280×800 视口截图顶栏 |
| 工具启动器分组 | 2.3.2 | 工具下拉展开后截图 |
| 隐式 token | 2.4.13 | DevTools 取 `--warning-bg` 等计算值, 找到使用它的元素截图 |
| 硬编码色值 | 2.4.14 | DevTools 取 `.reader` `.page-organizer` 计算 background-color, 与 `--bg` `--surface` 对比 |
| 999px 胶囊 | 2.4.19 | DevTools 检查 annotation 胶囊 / 缩略图 status marker / 文本层 badge / search-popover page-chip 圆角值 |
| 间距非体系 | 2.4.30 | 截图后采样若干按钮的 padding / gap, 抽样检查 |

### 选跑给信心(11 项)

通过项截图证明确实通过: 顶栏无 mode 按钮 / 侧边栏默认关闭 / 工具启动器 4 组齐全 / CSS 颜色 token 对齐 / 圆角 6/8px 大量使用 / 上下文工具条 42px / box-shadow 仅 3 处浮层。

## 输出

报告文件: `docs/plans/2026-06-14-faropdf-audit-stage-2-report.md`

格式: 11 个必跑场景 + 选跑 11 个, 每条 [PASS/FAIL/UNVERIFIED] + 截图证据 (本地路径) + 偏差详细描述。**重点是 FAIL 项目的具体表现和触发条件**, 这决定第 3 阶段 ISS 修复优先级。

## 范围与不变更项

- **不修改** `src/**` / `src-tauri/**` / 任何 docs/ 文件
- 启动 vite dev server, 但**不修改** vite.config / 依赖
- 第 2 阶段输出**只**新增 `docs/plans/2026-06-14-faropdf-audit-stage-2-report.md` + 临时截图文件 (保存到 `tmp/audit-screenshots/`, .gitignore)
- 截图文件: 11 个必跑 + 11 个选跑 ≈ 22 张, 每张约 200-500KB

## 已知限制

- **不启动 Tauri 桌面壳**, 所以 F-05 (另存为不走 Tauri dialog) 不能直接验证 — 标记 [UNVERIFIED]
- OCR stub 在 vite dev 环境下可能走 noop 路径而不是返回 queued job, 状态文本可能不同 — 标记 [PARTIAL]
- F-02 (压缩效果) 需要真实含高分辨率图的 PDF, 用 fixture 替代 — 标记 [FIXTURE]
- F-03 (图章 SVG) 扁平化导出的 PDF 需要外部工具打开看, 浏览器内 PDF.js viewer 是 web 应用而非 Tauri 导出字节流 — 标记 [PARTIAL]
