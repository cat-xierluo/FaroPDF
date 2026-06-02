# FaroPDF 项目协作指南

## 项目简介

FaroPDF 是一个独立 PDF 阅读器，面向律师日常阅读卷宗、证据、判决、合同和扫描材料。它的目标是像灯塔一样帮助用户在厚重材料中快速定位重点：打开得快、读得清楚、搜得到、批注能汇总、扫描件能 OCR，页面整理可回退。

技术栈规划：Tauri v2 + React + TypeScript + Vite + PDF.js + pdf-lib + OCR bridge

> 行为规则（SOP、任务晋升、完成标准等）遵循全局 `~/.codex/AGENTS.md`，本文件只补充 FaroPDF 项目级上下文。

## 基本约定

- 全程使用中文回复与写作。
- 遵循 `docs/ROADMAP.md` 路线图驱动开发。
- 待办事项记录到 `docs/TASKS.md`。
- 重要决策记录到 `docs/DECISIONS.md`。
- 用户可见变更写入 `CHANGELOG.md`。
- 涉及前端 UI 时遵循 `docs/DESIGN.md`。
- 涉及架构、数据流和模块边界时同步更新 `docs/ARCHITECTURE.md`。

## 文件清单

| 文档 | 位置 | 职责 |
| --- | --- | --- |
| README.md | 根目录 | 项目介绍、定位、快速开始 |
| CHANGELOG.md | 根目录 | 版本变更记录 |
| AGENTS.md | 根目录 | Codex / 通用 AI 协作规则 |
| CLAUDE.md | 根目录 | Claude Code 项目上下文 |
| DESIGN.md | docs/ | 视觉设计系统、UI 规范、组件样式 |
| ARCHITECTURE.md | docs/ | 系统架构、数据流、核心接口 |
| ROADMAP.md | docs/ | 路线图、阶段任务、进度日志 |
| DECISIONS.md | docs/ | 技术决策记录 + 工作日志 |
| TASKS.md | docs/ | 待办追踪：待处理任务、缺陷修复、技术债清理 |
| PDF_ALGORITHMS.md | docs/ | PDF 处理脚本算法融入计划 |

## 当前阶段

项目当前仅完成上下文初始化，还没有应用代码脚手架。正式开发前的第一项任务是创建 Tauri v2 + React + TypeScript + Vite 应用，并补齐开发、测试、构建命令。

## 计划中的开发命令

正式 scaffold 应用后补充实际命令。当前预期命令为：

```bash
npm install          # 安装依赖
npm run tauri dev    # 启动开发模式
npm run typecheck    # 类型检查
npm test             # 单元测试
npm run tauri build  # 构建桌面应用
```

## 关键设计决策

- 项目形态：FaroPDF 是独立项目，不并入 Folia。
- 渲染底座：PDF.js 负责页面渲染、文本层、目录、缩略图和搜索基础。
- 页面操作：pdf-lib 负责页面复制、删除、重排、表单、元数据和导出保存。
- 性能策略：页面虚拟化，只渲染可见页和邻近页；缩略图、全文索引、批注列表和 OCR 按需加载。
- OCR 策略：通过 bridge 调用本地 Legal Skills / `ocrmypdf`，并预留 PaddleOCR / MinerU；联网 OCR 必须用户确认。
- PDF 算法来源：扫描清洁校正、压缩、OCR provider、证据图片编排和文书整理 manifest 参考 `docs/PDF_ALGORITHMS.md`。
- 保存策略：原始 PDF 默认不可变；批注先保存 sidecar，导出时再写入或扁平化到新 PDF。

## PDF 安全边界

- 不直接覆盖用户打开的原始 PDF，除非用户明确选择覆盖并二次确认。
- 批注、页面重排、OCR、压缩、解密和表单扁平化默认输出新 PDF。
- 批注第一版允许使用 sidecar 保存可编辑状态。
- 删除页、重排页、OCR 重建文字层、水印去除、解密等高风险操作必须提供输出路径和可回退策略。
- 法律材料可能包含隐私、商业秘密和案件信息；调用联网 OCR 服务前必须让用户明确知情。
- 不在日志、提交或公开文档中写入完整密钥、Token、密码或敏感案件信息。

## 项目本地 Skills

`project-init` 已按开发项目 profile 安装以下本地 skills 到 `.claude/skills/`：

- `git-batch-commit`
- `git-workflow`
- `release-workflow`
- `multi-agent-orchestration`
- `cross-agent-coordination`
- `agent-email`

后续需要调整项目类型或新增技能时，优先使用 `project-init` / `skill-manager`，不要手动复制 skill 内容。
