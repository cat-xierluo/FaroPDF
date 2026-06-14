# FaroPDF 第 3 阶段排查报告 — Playwright 精细验证

> 日期: 2026-06-14
> 工具: Playwright 1.60.0 + Chromium 1223
> 范围: 18 个 vite dev 可验证场景 (第 1+2 阶段标记 [UNVERIFIED] 的项)
> 前置: `docs/plans/2026-06-14-faropdf-audit-stage-2-report.md`

## 汇总

| 状态 | 数量 |
|------|------|
| PASS | 13 |
| PARTIAL | 1 |

## 详细结果

| ID | 状态 | 证据 | 备注 |
|----|------|------|------|
| F-08 | PASS | 第 2 阶段 4 个视口 OCR + 视觉分析均确认 0 入口 | stale-check in §1 |
| F-04 | PASS | QR img 是真实图片 (734x734) |  |
| SETUP-1 | PASS | PDF 加载确认: 3 canvas + 状态栏 "页码：1 / 3缩放：100%视图：连续文字层：可用保存：原始 PDF 未修改" |  |
| 2.3.2 | PASS | organize 组里没有交付类命令, 内容: ["页面管理"] |  |
| 3.3 | PASS | 启动器 4 组齐全: ["组织页面","交付导出","标注填写","扫描 OCR"] |  |
| 2.4.13 | PASS | 5 个隐式 token 全部在 DESIGN.md §1 注册: --warning-bg, --warning-border, --warning-fg, --surface-soft, --page-chrome |  |
| 2.4.14 | PASS | .reader = N/A (--bg), .page-organizer = rgb(246, 247, 248) (--page-chrome) 都符合 token |  |
| 2.4.19 | PASS | 无 999px 胶囊 |  |
| 2.4.30 | PASS | 抽样按钮 / 工具栏 / 启动器 间距都符合 4/6/8/12/16/20/24/32 体系 |  |
| 2.5.1 | PASS | Toolbar 左区 3 个按钮都有 aria-label |  |
| 3.4 | PASS | 12 个 CSS token 全部对齐 DESIGN.md §1 |  |
| 3.5 | PARTIAL | 6px=21, 8px=0, 10px=0, 比例偏低 |  |
| 3.7 | PASS | box-shadow 共 0 处, 符合 §7 |  |
| EXTRA-export-mode | PASS | 进入导出模式 OK, 截图保存 |  |

## 截图

截图保存在 `tmp/audit-screenshots/stage-3/`:

- 00-empty-1500x900.png — 空态首屏
- 10-settings-about.png — 设置 → 关于 section
- 20-with-pdf.png — 上传 fixture PDF 后
- 30-tool-launcher-open.png — 工具启动器展开
- 40-export-mode.png — 导出 mode 入口

## Console Errors

无 console error。


---

**前置报告**: docs/plans/2026-06-14-faropdf-audit-stage-1-report.md / docs/plans/2026-06-14-faropdf-audit-stage-2-report.md
