# FaroPDF 项目协作指南

## 项目定位

FaroPDF 是一个独立 PDF 阅读器，面向律师日常阅读卷宗、证据、判决、合同和扫描材料。项目不并入 Folia，不承担 Markdown 编辑、Word 导出或公众号 HTML 导出的职责。

核心目标：

- 足够快：大 PDF 打开、翻页、缩放、搜索时保持轻快。
- 足够清亮：界面克制，内容优先，减少工具栏和面板干扰。
- 法律材料友好：重视文字层、OCR 状态、批注汇总、页面整理、页码和材料交接。
- 默认安全：不覆盖原始 PDF，所有破坏性操作默认另存、导出或写入可回退 sidecar。

## 基本约定

- 全程使用中文回复与写作。
- 遵循 `docs/ROADMAP.md` 路线图驱动开发。
- `docs/TASKS.md` 是唯一任务源；待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议都记录在这里。
- 重要技术选择和工作摘要记录到 `docs/DECISIONS.md`。
- 用户可见变更写入 `CHANGELOG.md`。
- 涉及 UI、交互和视觉时遵循 `docs/DESIGN.md`。
- 涉及架构、数据流、模块边界时同步更新 `docs/ARCHITECTURE.md`。

## 文件清单

| 文档 | 职责 |
| --- | --- |
| `README.md` | 项目介绍、定位、快速开始和当前状态 |
| `CHANGELOG.md` | 用户可见变更记录 |
| `docs/ROADMAP.md` | 路线图、阶段任务和进度日志 |
| `docs/TASKS.md` | 唯一任务源：待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议 |
| `docs/DECISIONS.md` | 技术决策记录与工作日志 |
| `docs/ARCHITECTURE.md` | 架构、数据流、核心接口和技术边界 |
| `docs/DESIGN.md` | 视觉系统、布局、控件和交互规范 |

## PDF 安全边界

- 不直接覆盖用户打开的原始 PDF，除非用户明确选择覆盖并二次确认。
- 保存批注、页面重排、OCR 双层结果、扁平化表单等操作，默认输出为新 PDF。
- 批注第一版允许使用 sidecar 保存可编辑状态；导出时再写入或扁平化到 PDF。
- 删除页、重排页、压缩、OCR 重建文字层、水印去除、解密等都属于高风险操作，必须提供预览或输出文件路径。
- 法律材料可能包含隐私、商业秘密和案件信息；调用 PaddleOCR、MinerU 等联网 OCR 服务前必须让用户明确知情。
- 本地 OCR、页面处理和质量检查优先放在后台任务，不阻塞打开文档和阅读。
- 发现密钥、Token、密码、证件号等敏感信息时，不写入公开仓库，不在日志中完整输出。

## 开发策略

- 第一阶段先搭建可日用的基础版：快读、检索、批注、OCR bridge、页面整理、表单签署。
- 技术实现优先按需加载：首屏只加载应用 shell 和基础阅读能力，缩略图、全文索引、批注列表、OCR 和页面整理按需启动。
- PDF.js 负责阅读渲染和文本层；pdf-lib 负责页面复制、删除、重排、表单和导出保存；OCR 通过 bridge 调用本地工具或用户确认后的云端能力。
- 扫描清洁校正、压缩、OCR provider、证据图片编排和文书整理 manifest 的算法来源记录在 `docs/TASKS.md`。
- 避免把重型 OCR 引擎、批量转换链路或扫描预处理同步塞进前端主线程。
- 面向律师工作流时，优先做“可验证、可回退、可交接”的能力，而不是炫技式编辑。

## 多 Agent 与 worktree 编排

- Agent 以 `docs/TASKS.md` 为唯一任务源，不另建任务计划文档。
- Agent 可根据 `docs/TASKS.md` 自行判断哪些素材应晋升为正式 ISS，哪些 ISS 可放入同一 worktree 分支顺序推进。
- 文件范围重叠、共享依赖多或存在强依赖链的任务可以同组；会争抢脚手架、锁文件、`src-tauri/`、`src/shared/` 或全局布局的任务必须谨慎拆分。
- 分支和 worktree 命名遵循 `git-workflow` 与 `multi-agent-orchestration`：分支名写任务语义，worktree 路径可写本地执行来源前缀。

## 完成标准

1. 功能或文档变更已完整落地。
2. 有明确验证方式，且验证结果写入最终回复。
3. 相关文档已同步更新。
4. 不存在已知阻塞问题。
5. 来源于 `docs/TASKS.md` 的任务已更新状态或归档。
6. 涉及 UI 时已确认符合 `docs/DESIGN.md`。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
npm run tauri dev
npm run tauri build
cd src-tauri && cargo check
```
