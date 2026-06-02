# FaroPDF

FaroPDF 是一个独立 PDF 阅读器，面向律师日常处理卷宗、证据、判决、合同和扫描材料。

`Faro` 有灯塔、指引的含义。FaroPDF 的产品目标是在厚重 PDF 材料中快速照亮重点：打开得快、读得清楚、搜得到、批注能汇总、扫描件能识别、页面能整理。

## 当前状态

当前阶段已完成 Foundation Gate，并接入 PDF.js 阅读底座、设置/OCR provider 配置、PDF Expert 风格基础 Shell 和文本层搜索第一版。搜索第一版支持按需页文本索引、命中列表、上下一个命中、当前页轻量高亮和扫描件 OCR 提示。

已固定：

- 独立项目，不并入 Folia。
- 技术方向：Tauri v2 + React + TypeScript + Vite + PDF.js + pdf-lib。
- 首版目标：快读、检索、批注、OCR/扫描、页面整理、常用导出、表单签署和设置。
- 安全边界：默认不覆盖原始 PDF，高风险操作另存或导出。
- 并行策略：Foundation Gate 合并后按 `docs/TASKS.md` 拆分多分支、多 worktree。

## 首版能力目标

- 快读：打开大 PDF、连续/单页阅读、缩放、页码跳转、缩略图、目录、最近文件。
- 检索：文字层检测、全文搜索、命中列表、当前页高亮、无文字层提示 OCR。
- 批注：高亮、下划线、删除线、备注、文本框、矩形、箭头、手写、图章、批注列表与导出摘要。
- 页面整理：旋转、删除、重排、插入、提取、合并、添加页码和 Bates 编号。
- OCR/扫描：检测无文字层页面，调用 OCR bridge 生成双层 PDF，并展示质量检查状态。
- 常用导出：添加文字/图片水印、压缩预设、批注扁平化、表单扁平化和另存输出。
- 表单签署：AcroForm 填写、基础签名图片或手写签名、导出扁平化 PDF。
- 设置：默认保存目录、最近文件、OCR provider、PaddleOCR/MinerU API 配置和联网 OCR 隐私确认。

## 设计原则

- 内容优先：PDF 页面是主角，工具栏和侧边栏默认保持克制。
- 速度优先：采用虚拟化渲染，只渲染可见页和邻近页。
- 法律友好：重点支持长卷宗、扫描件、证据材料、批注汇总和页面编号。
- 离线优先：本地能力优先，联网 OCR 或云端处理必须让用户明确知情。
- 可回退：批注和页面操作先保留可编辑状态，导出时再写入新 PDF。

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
```

当前基础验证命令：

```bash
npm run typecheck
npm test
npm run lint
npm run build
cd src-tauri && cargo check
```

## 文档

- `AGENTS.md`：协作规则和 PDF 安全边界。
- `docs/ROADMAP.md`：路线图和首版范围。
- `docs/TASKS.md`：唯一任务源，记录待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议。
- `docs/DECISIONS.md`：关键决策记录。
- `docs/ARCHITECTURE.md`：技术架构和接口模型。
- `docs/DESIGN.md`：视觉与交互规范。
