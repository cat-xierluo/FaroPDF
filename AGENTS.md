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
| `docs/reference/pdf-expert/` | （本地内部素材，已 gitignore，不上传公开仓库） |

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

## UI 与多 Agent 协作门禁

UI 改动遵循通用纪律：功能任务以 `behavior-complete` 为完成线，未实现入口必须 fail-closed（明确禁用而非静默无响应）。全局布局、共享状态、`src/App.tsx`、`AppShell`、全局样式和共享契约始终只允许一个 owner，避免多 worker 并发改同一文件。

每个 worker prompt 必须写明目标 surface、allowed files、forbidden files、交付等级和行为验证；PM 必须复核真实交互断言和 PDF round-trip 结果，worker 的自述、typecheck、单测或 build 不能单独构成完成证据。

阶段并发权和当前唯一可领取项以 `docs/TASKS.md` 为准。

## Skill 强制调用

FaroPDF 的协作依赖 `.claude/skills/` 下的 Skill 统一协议、门禁和工作流规范。下面场景必须先调用对应 Skill 再行动，避免漏掉协议、提交门禁或交接约束：

| 触发场景 | 必须先调用 | 调用的理由 |
| --- | --- | --- |
| git 提交、批量提交、commit message 拆分与归并 | `git-batch-commit` | 拆分粒度、commit 格式、PR 编号后缀由该 Skill 统一 |
| 分支创建、PR、merge、worktree 切换、push 前安全检查 | `git-workflow` | 安全门禁、Monorepo 目录级 checkout、fail-closed 合并条件 |
| 多 Agent / subagent / worktree 并行 / 跨会话交接 | `multi-agent-orchestration`、`cross-agent-coordination` | worker 文件范围边界、PM 派工、跨平台归属与交接 |
| `docs/TASKS.md` 任务领取、状态更新、归档迁移 | `cross-agent-coordination` | 任务状态机、归属和归档入口由该 Skill 管理 |
| 发布与版本变更 | `release-workflow` | 版本号、CHANGELOG 与发版流程 |
| 功能改动自测 / 声称「修完」/ 提交 PR 前 | `verification-gate` | 8 阶段验证门禁（编译层 1-4 前置 + e2e/真机 5-6 硬门禁 + 安全/Diff 7-8），§自测纪律与 §验证体系的 skill 化执行入口 |
| 文档膨胀 / 归档不一致 / PR 创建后 / PR 合并后 | `doc-curator` | 文档瘦身 subagent 跑体检，必要时自动提 maintenance PR；post-action 触发，不阻断 PR |

通用原则：

- 凡是「看起来可能要调用某个 Skill」的场景（即使只有 1% 概率），先调用再决定是否沿用。
- Skill 加载后必须按其清单和门禁执行，不允许「看个大概就跳过」。
- 触发表随项目 Skill 增删同步更新；新增 Skill 时必须在本节追加触发场景。

## 多 Agent 并行与 PR 收口纪律

开多 Agent session / worker 并行时，PM 必须按以下硬约束执行。违反任一条都视为协议违反，需 git revert 链或开 maintenance PR 修复，**不能直接 commit 修复**。

### 1. 双层监测（防 silent done）

worker spawn 后 PM **必须同时挂两层监测**，不能只挂 sentinel：

- **① sentinel**（`multi-agent-orchestration` skill `scripts/sentinel.sh`，`run_in_background=true`）：worker 写 STATUS `done` 时 exit → harness 唤醒 PM。事件驱动的快路径。
- **② 定时巡检**（`scripts/pm-monitor.sh --log-file` 或 PM 主动 `bash` 循环 ~15 min 一次）：检测 **silent done**——判据：tmux pane 回到 `❯` 就绪态 + worktree 已有 commit + 无 STATUS.json（或 STATUS 无 `done`）→ worker 完成了业务但跳过 STATUS / RESULT 协议，PM 主动收口（读 diff + pane 自述 + 验证 + 合并）。

**原因**：worker 进程在不同 provider / 负载下指令遵循会波动——同 prompt 下有的写 STATUS、有的跳过（实测 2026-06-21 W1 ISS-NEW-A 撞 pre-existing vitest 环境问题时 STATUS 延迟更新）。只挂 sentinel 会漏掉 silent done，直到用户来问才发现。

### 2. 收窄 envelope 不默认 lean

worker spawn 默认带完整上下文（AGENTS.md / DESIGN.md / `docs/TASKS.md` 对应 Issue / `docs/DECISIONS.md` 已关闭 DEC 摘要 / 必读素材），不默认 `disableBundledSkills + 空 MCP` 的 lean 配方。lean 仅在 worker 真 autocompact thrash 时临时用，用完恢复完整上下文。

### 3. PR 第一动作（worker 完成后 PM 第一动作 = 建 PR）

worker 提交 commit 后，PM 第一动作是 **`gh pr create`**，**不是** `git merge --ff-only` 到 main、不是直接 commit docs 到 main、不是先推 local main 再 cherry-pick。任何形式的"绕过 PR 收口"都视为协议违反。

PR 正文必须列：

- 覆盖的 Issue ID（`ISS-NEW-A` 等）
- 变更摘要（files / +/- 行数）
- 验证方式（typecheck / test / lint / build / cargo check 实际结果）
- 来源材料（`docs/TASKS.md` 对应章节、`docs/DECISIONS.md` 引用 DEC 编号）
- 已更新的协作文档（CHANGELOG / DECISIONS / TASKS / ROADMAP）
- Agent Attribution（Worker backend + provider slot + commit SHA）
- 仍需人工确认的风险（pre-existing test 失败 / 类型约束变更 / 共享契约 race 等）

PM 跑 `gh pr view --json mergeable,mergeStateStatus,baseRefOid,headRefOid` 做收口检查；merge 由用户 review 后执行。

### 4. 范围控制（worker 不顺手扩大改动）

Worker 只处理分配给自己的 Issue / 分组。执行中发现新缺陷、依赖或技术债时：

- 先记到 `docs/TASKS.md` 新 Issue 卡（不在本 PR 范围）
- 除非阻塞当前任务或用户明确要求，**不**顺手扩大本 PR 改动范围
- 范围扩大判定：commit 修改文件超出 spawn prompt 列出的 allowed files 列表时，PM 应在 commit 后 review 阶段发现并要求 worker 拆 PR

PM 自己也要遵守：本会话内新增文件 / 改 docs / 修 build 脚本等"顺手动作"也要走文档闭环（TASKS / DECISIONS / CHANGELOG），不能游离在 worker PR 之外直接 commit 到 main。

**关联**：本节由 DEC-145 落地，2026-06-21 Wave 1 W1 (ISS-NEW-A 阶段 1) 协议违反后补强。

## 完成标准

1. 功能或文档变更已完整落地。
2. 有明确验证方式，且验证结果写入最终回复。
3. 相关文档已同步更新。
4. 不存在已知阻塞问题。
5. 来源于 `docs/TASKS.md` 的任务已更新状态或归档。
6. 涉及 UI 时已确认符合 `docs/DESIGN.md`。
7. **功能改动必须自测通过（见 §自测纪律）**：`typecheck` / 单测 / `npm run build` 只证明「代码能编译」，**不证明「功能真能用」**。Reader / 拖入 / 批注 / 导出 / OCR / 设置 / UI 交互等功能改动，必须跑功能 e2e（或实机）确认核心路径可用，才算完成。**仅 typecheck 过就声称「修完」是误导**（2026-08-05 教训：QA-02 workerPort typecheck 全过，实机却「文字层未知」未解决，根因是 `textLayerStatus` 检测，不是 pdfjs worker）。

## 自测纪律（e2e / 实机，2026-08-05 教训落地）

> 教训：QA-02 workerPort 改完 `typecheck` PASS 就声称「修完」，实机却「文字层未知」（`textLayerStatus` 卡 `unknown`，根因不是 pdfjs worker）。**typecheck 过 ≠ 功能可用**。本节把「修改后自测」固化成纪律，堵这个盲区——这正是不开 dev / 不跑 e2e 就声称完成的解药。

**核心规则**：

1. **改完先自测，再提交 / PR / 声称完成**。功能改动必须跑**功能 e2e**（或实机）确认核心路径可用；`typecheck` / 单测 / `build` **不单独构成完成证据**，只是前置编译门禁。
2. **e2e 覆盖（按改动域选）**：
   - **Reader 改动**（pdfjs / worker / textLayer / 打开链路）：e2e 打开 `tests/fixtures/expert/reference.pdf` → 断言**页面真的渲染**（canvas 非空 / 页数 / `textLayerStatus ≠ "unknown"`）。
   - **拖入**（DragDrop）：e2e mock `faropdf://file-drop` 事件 → 断言打开。
   - **UI 交互**（设置 / 批注 / mode / Toolbar）：e2e 点击 → 断言面板 / 元素出现（Playwright DOM bbox）；结构断言用组件测试 + `test:e2e`（`verify:ui-layout` 已随 PDF Expert 素材下架移除，2026-07-31 commit `02b07aa`）。
   - **视觉**（颜色 / 间距 / emoji）：DOM 断言 + 人工实机（「好看 / 高级」是主观，不自动化）。
3. **e2e 不过 = 任务未完成**：不提交 PR、不声称 `behavior-complete`、worker STATUS 不写 `done`；e2e 失败记 RESULT + 修到过为止。
4. **worker prompt 必须列 e2e 命令**：派 worker 时 `--verify-cmd` 含**功能 e2e**（不只 `npm run typecheck`）；PM 收口复跑 e2e 才算验收。
5. **dev webview 缓存坑**：实机 review 前 Tauri webview 要**硬刷新**（Cmd+Shift+R）或清缓存，否则看旧代码（UI「没变化」假象，2026-08-05 实测：改动 +336 行在 main，webview 缓存让用户看不到）。

**e2e 命令**（Playwright 1.60.0 + vitest e2e 已落地，2026-08-14 verification gate 补齐）：

- `npm run test:e2e` —— vitest + 真 pdfjs + fixture（reader-renders / forms / ocr，jsdom legacy fake worker，约 5s，CI test job 跑）。
- `npm run verify:reader-e2e` —— **chromium 真 module Worker 门禁**（脚本自起 dev server：打开 `reference.pdf` 断言 `textLayerStatus="available"` + `corrupt.pdf` 抛 `InvalidPDFException`），reader / pdfjs / worker / 字体链路改动的回归门禁（QA-02「jsdom 过、真机崩」那层的拦截器），CI reader-e2e job 跑。
- `npm run verify:ui-layout` —— **已移除**（2026-07-31 公开仓库准备，PDF Expert 几何验证脚本随第三方截图素材 git rm，commit `02b07aa`）；结构断言由组件测试 + `test:e2e` 承接。

**参照**：全局 `~/.codex/AGENTS.md` §3.1 实操验证（GUI / Web / 桌面：启动入口 + 代表性交互 + DOM 断言 / 截图）；本节是 FaroPDF 项目级具体化。

## 验证体系（CI / e2e / fixture / etv / 断言深度，参照 Folia 实践）

> FaroPDF 是 Tauri 桌面应用，验证体系参照同栈的 **Folia 项目**（`/Users/maoking/Library/Application Support/maoscripts/folia`）——它有完整 e2e + CI playwright job + fixture 矩阵 + 真实桌面 etv + 深度断言，改功能 e2e 兜底，所以进展不费力。本节把 Folia 那套验证体系落成 FaroPDF 规范，堵「`typecheck` 过就说修完 → 实机崩」的坑（2026-08-05 QA-02 教训）。

### 验证层（完成线 = e2e 过，不只 typecheck）

| 层 | 命令 | 证明什么 | 完成线 |
|---|---|---|---|
| 编译 | `npm run typecheck` / `lint` / `build` / `cd src-tauri && cargo check` | 代码能编译 | 前置门禁，**不充分** |
| 单元 | `npm test`（vitest 全量，136 文件 / 1495 用例，~70s 正常退出——悬挂已修 DEC-199） | 单元逻辑 + e2e 子集 | 前置门禁 |
| **e2e（jsdom）** | `npm run test:e2e`（vitest + 真 pdfjs + fixture，7 用例） | pdfjs 逻辑 / 表单 / OCR 链路 | **核心完成线** |
| **e2e（真 Worker）** | `npm run verify:reader-e2e`（chromium 真 module Worker + 字体 fetch） | **真 Worker / standardFontDataUrl 行为**（QA-02 层） | **核心完成线** |
| 结构 | 组件测试 + `test:e2e` DOM 断言（`verify:ui-layout` 已移除，`02b07aa`） | DOM 结构 / 关键元素 | UI 改动门禁 |

### CI/CD（e2e 必须在 CI，不只本地）

- `.github/workflows/ci.yml` 已上 main（2026-08-14 verification gate 补齐）：`test` job（typecheck + lint + **全量 `pnpm test`** + build）+ `reader-e2e` job（chromium 真 Worker，参照 Folia playwright job；failure 上传 artifact 7 天）。全量单测曾因 vitest 退出悬挂只跑 `test:e2e` 子集，悬挂修复（DEC-199）后已扩回全量。Tauri / cargo 构建由 release.yml 负责（macOS WKWebView 等 release-only 依赖不在 ubuntu runner 编译）。

### fixture 矩阵（e2e 用受控 fixture，复现一致）

`tests/fixtures/` 已具备多场景 fixture，e2e 直接用：
- `expert/reference.pdf`（5 页 A4，纯英文文字层）—— 正常渲染基准
- `reader/encrypted.pdf`（qpdf 256-bit 加密，密码 test123）—— 密码 PDF
- `reader/corrupt.pdf`（截断，触发 InvalidPDF）—— 损坏错误态
- `forms/reference-form.pdf`（AcroForm 4 字段）—— 表单
- `ocr/scan-only-sample.pdf`（扫描件无文字层）—— OCR / `textLayerStatus=missing`

### 真实桌面 etv（dev server e2e 不够，要真实 Tauri 运行时）

- 参照 Folia `scripts/etv-folia.mjs`（`etv:dev` = `WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222 tauri dev` / `etv:run` = `node scripts/etv-folia.mjs`）—— 真实 WKWebView 启动 + DOM 测量 + 截图。
- **FaroPDF 已建** `scripts/etv-faropdf.mjs`（2026-08-14）：`npm run etv:dev` 起真机 + `npm run etv:run` 跑 CDP 断言（app-boots：Toolbar 5 段 + Welcome/Canvas + 截图存档 `.playwright-mcp/`），作为 dev server Playwright 之外的**真机门禁**（dev server 跑 vite localhost，Tauri 真实 WKWebView 行为可能不同——QA-02 workerPort 就是 prod/真机才暴露）。
- **已知限制**（DEC-196）：`WEBKIT_INSPECTOR_SERVER` 在 wry 当前 macOS 版本可能不生效——etv 连不上时脚本明确失败并给降级指引（`tauri build` 产物实机 + `verify:reader-e2e` 证据链），不允许静默跳过真机层。

### 断言深度（防「伪渲染 / 假成功」，参照 Folia mermaid-fidelity）

**不只断言「存在 canvas / 存在元素」，断言功能结果**：
- **Reader**：canvas 像素非空（真渲染，非空白页）+ 页数正确 + `textLayerStatus ≠ "unknown"`（文字层检测成功，不是默认值）。
- **拖入**：mock `faropdf://file-drop` 事件 → 断言 reader 进入 loaded 态（document 非空）。
- **UI 交互**：点设置齿轮 → 断言 `SettingsPanel open`；mode 切换 → 断言对应 panel 出现（DOM bbox 非空）。
- Folia 教训（`docs/TASKS.md:266`）：「Mermaid 不再仅用『存在 `<svg>`』验收；**节点文字可见 + `getBBox` 像素非空 + 安全属性剥离**」——FaroPDF reader 同理（canvas 像素 + `textLayerStatus`），防「有页面无内容」伪渲染。

### 完成定义（落地）

功能改动（reader / 拖入 / 批注 / 导出 / OCR / 设置 / UI 交互）必须：`typecheck` + `test:e2e` + **`verify:reader-e2e`（reader / pdfjs / worker / 字体链路改动）或 etv 真机** 全过（CI 绿），才算 `behavior-complete`。**e2e 不过 = 未完成**（不 merge / 不 release / worker STATUS 不写 `done`）。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run test:e2e          # e2e 子集（reader/forms/ocr，jsdom，CI 同款）
npm run verify:reader-e2e # reader/pdfjs/worker/字体链路门禁（chromium 真 Worker，自起 dev server）
npm run etv:dev           # 真机门禁前置：带 WKWebView inspector 的 tauri dev
npm run etv:run           # 真机门禁：CDP 断言 app-boots + 截图（需先 etv:dev）
npm run lint
npm run build
npm run tauri dev
npm run tauri build
cd src-tauri && cargo check
```
