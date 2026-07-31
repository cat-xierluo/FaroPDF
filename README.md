<p align="center">
  <img src="docs/icon-128.png" alt="FaroPDF" width="128" height="128">
</p>

# FaroPDF

一个面向知识工作者的独立 PDF 阅读器 —— 快读、检索、批注、OCR、页面整理、表单签署一条龙。

`Faro` 取灯塔、指引之意。FaroPDF 帮你在厚重 PDF 材料里快速定位、标注、整理和交付：打开快、读得清、搜得到、批注能整理、扫描件能识别、页面能重排、签署能落地。

## 官方网站

- 官网：[https://cat-xierluo.github.io/faropdf/](https://cat-xierluo.github.io/faropdf/)
- 源码：[https://github.com/cat-xierluo/FaroPDF](https://github.com/cat-xierluo/FaroPDF)

## 下载与安装

普通用户建议直接从 [GitHub Releases](https://github.com/cat-xierluo/FaroPDF/releases/latest) 下载最新版本。

- macOS Apple Silicon：下载带 `aarch64` / `arm64` 字样的 `.dmg`
- macOS Intel：下载带 `x64` / `x86_64` 字样的 `.dmg`
- Windows：下载 `.exe` 安装包

安装后 FaroPDF 会默认检查更新，也可以在"设置 / 关于"中手动检查或关闭自动检查。

### macOS 首次运行

当前版本尚未做 Apple Developer 公证。如果 macOS 提示"无法验证开发者"或"已损坏"，请先把 `FaroPDF.app` 拖到"应用程序"，然后在终端执行一次：

```bash
xattr -dr com.apple.quarantine /Applications/FaroPDF.app
open /Applications/FaroPDF.app
```

如果你把应用放在其他位置，请把命令里的 `/Applications/FaroPDF.app` 换成实际路径。这个命令只应对你信任来源的应用执行。

## 当前状态

FaroPDF 处于 v0.2 开发阶段（v0.1 基础版已封箱至 0.1.0-alpha.18）。当前已落定的核心能力：

- **阅读**：PDF.js 快速渲染、连续/单页/双页/适合宽度、缩放、旋转、键盘翻页、文字层检测、会话恢复。
- **检索**：全文搜索（命中列表、上下一个、当前页高亮）、PDF 大纲（书签 destination）读取。
- **批注**：9 类型批注 sidecar、形状样式（6 类）、批注摘要分组导出、扁平化。
- **页面整理**：真实缩略图、多选、拖拽重排、旋转/删除/撤销、复制/粘贴剪贴板、插入 PDF/空白页、合并、提取页码范围，均另存为新 PDF。
- **导出**：文字/图片水印、页码/Bates 编号、页眉页脚（奇偶页 + 位置）、压缩、密码设置/移除、文档属性写回。
- **OCR**：本地 ocrmypdf / 云端 PaddleOCR / MinerU bridge，质量报告。
- **表单**：AcroForm 识别、填写、签名嵌入、扁平化。
- **异常态**：损坏 PDF、加密 PDF（密码输入闭环）、权限不足、OCR 失败均有可复现的中文错误反馈。
- **安全边界**：所有破坏性操作默认另存新副本，不覆盖原始 PDF。

详细路线图与阶段状态见 `docs/ROADMAP.md`，决策记录见 `docs/DECISIONS.md`。

## 功能

以下能力基于 v0.1.1 实际交付范围（详见 `CHANGELOG.md`）：

> PDF Expert 只作为功能框架和信息架构参考，不追求像素级一比一。当前验收重点是入口接真实模块、写入产物可重开、未实现功能明确禁用。现状和下一步见 [`docs/reference/pdf-expert/`](docs/reference/pdf-expert/README.md) 与 [`docs/TASKS.md`](docs/TASKS.md) 的 ISS-NEW-M。

### 阅读与检索

- L2 tab bar + L3 五段工具栏；导航、缩放、核心工作流、摘要/交付和搜索按功能层级排布
- `T 编辑` 内容引擎未接入，入口明确禁用；“页面管理”使用独立页面网格和真实缩略图，拖拽重排、旋转、删除、撤销和另存副本已接真实 PDF 写回
- read 模式不显示 L4；左右栏出现时中央阅读区始终保持在 L5a 与 L5b 之间
- 打开本地 PDF（对话框 / 拖拽），PDF.js worker 独立加载，不阻塞主线程
- 页面虚拟化：只渲染可见页和邻近页，大卷宗打开轻快
- 4 种视图模式：连续 / 单页 / 双页 / 适合宽度
- 8 项缩放预设（50/75/100/125/150/200% / 适合宽度 / 适合页面）+ 顺 / 逆时针 90° 旋转
- 键盘翻页（PageUp / PageDown / 方向键 / Space / Home / End）
- 左侧文档摘要：真实缩略图、按页码跳转、当前页高亮、紧凑批注 / 搜索 / OCR 状态标记
- 个人页面书签：添加当前页、重复添加幂等、按页排序、当前页标记、点击跳页、删除与刷新恢复；按 PDF 隔离且不改写原文件
- 阅读位置本地恢复（按 PDF fingerprint 持久化 currentPage / zoom / viewMode / rotation）
- 全文搜索：按需建立页文本索引、命中列表、上下文片段、当前页轻量高亮、上下一个命中跳转
- 搜索结果层：索引计数、命中页码 chip、当前命中高亮、自动滚到对应页
- 纯扫描或文字层缺失时提示跳转 OCR 模式

### 批注

- 12 种批注类型：高亮 / 下划线 / 删除线 / 备注 / 文本框 / 矩形 / 椭圆 / 直线 / 单向箭头 / 双向箭头 / 手写 / 图章
- 形状右栏真实控制线型、线宽、不透明度、边框色和填充色；刷新从 sidecar 恢复，扁平化后写入新 PDF
- 6 色色板 + 5 套图章模板（矩形 / 圆角 / 椭圆 / 横幅 4 种 shape）
- 批注侧边栏：批注列表 + 当前页 / 总页数 + 选中跳页
- AnnotationOverlay 对齐当前页真实 canvas bbox（点击 / 拖拽 / 手写 3 种交互模式），DOM 坐标会转换到 PDF 用户空间
- AnnotationToolbar 挂到上下文工具条
- 中文图章真实绘制（思源黑体 SC + pdf-lib fontkit 嵌入）
- 默认保存为可编辑 sidecar（当前使用 localStorage adapter，schema version 1，存储不可用时回退内存）；导出时可扁平化到 PDF
- 批注摘要导出为 Markdown / HTML（不包含真实用户文件名）

### 页面整理

- 页面旋转、删除、重排（pdf-lib 真实改写）
- 多选 + shift+click 区间选择 + 删除前 RiskConfirmDialog
- 另存为新 PDF 时弹 ExportRiskDialog（不覆盖原始文件）
- 真实 Undo 状态栈；页面复制/粘贴在剪贴板实现前明确禁用
- 默认输出 `*-organized.pdf`，绝不覆盖原始 PDF

### OCR / 扫描

- OCR bridge 真实接入：本地后端走 `ocrmypdf`（`local-ocrmypdf` / `legal-skills`）
- 云端 provider 走 HTTPS 端点（PaddleOCR / MinerU），未授权时 guard 拒绝
- 任务队列持久化到 `app_config_dir/ocr-jobs.json`，启动时回收残留 running 任务为 cancelled
- 4 个 Tauri command：`list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` / `extract_ocr_text`
- 凭证引用仅接受 `env:NAME` 安全形式；明文 API Key 仍被 `isSafeApiKeyRef` 拒绝
- OCR 完成后 `pdftotext` 抽页面文本喂给质量检查服务
- OCR 模式工具条接入 AppShell：识别文本 / 输出双层 PDF / 质量检查 / 任务列表
- OCR 工作台：左侧任务列表（选 / 取消 / 打开报告）+ 右侧质量报告视图
- 质量报告：可检索页比例、关键词命中、CER（Levenshtein 距离）、体积比和耗时
- 扫描预处理（lopdf 真实清洁）：validating → preprocessing → writing-output → completed 状态机，裁边、方向检测 plan-only

### 导出

- 导出引擎（pdf-lib）：复制、删除、重排、旋转真实改写
- 表单填写与扁平化：同一内存工作副本累计 fill / sign / flatten，每一步只下载新 PDF；真实 AcroForm fixture 已完成 UI 导出和重开验证
- 批注扁平化：plan-only 与 draw 双策略，draw 走 `writeAnnotationPdf`
- 文字 / 图片水印、页眉页脚（全部页面 / 奇数页 / 偶数页，页眉 / 页脚位置）、Bates 编号、普通页码写入 PDF
- 证据图片 A4 编排：JPEG / PNG 真实拾取、PDF 页面真实嵌入、按 A4 1 / 2 / 3 / 4 张每页自动编排
- 压缩预设会生成真实新 PDF：对象流保存、JPEG DCTDecode 图像重编码和目标体积检查已接入；DPI 降采样仍留 follow-up
- 默认输出 `*-delivery.pdf` / `*-organized.pdf` / `*-evidence-pack.pdf` 等新文件

### 表单签署

- 读取 AcroForm 字段（text / dropdown / checkbox / radio）
- FormsPanel 左侧工具面板：按字段类型分组渲染 + 填值编辑器
- 签名图片（PNG / JPG）嵌入已有字段位置；自由拖放签名位置仍未实现
- 同一会话连续填写、勾选、签名和表单扁平化不会回退到原始 bytes；单条失败封装为 `status: "failed"`
- reader 暴露 `getFileBytes` / `saveUpdatedBytes`，导出走浏览器原生 `<a download>`

### 设置

- 默认保存目录、最近文件、默认缩放、阅读布局和浅色 / 深色外观
- macOS 中文菜单栏：新建窗口、打开、另存为、视图 / 工具深层入口和帮助关于；系统窗口动作不显示占位提示
- OCR provider 配置：本地 `ocrmypdf`、PaddleOCR、MinerU
- 联网 OCR 隐私确认策略（云端 OCR 必须用户主动确认）
- API Key 脱敏：不写入版本库，不在 UI / 日志 / 错误报告中完整输出
- 检查更新：基于 `tauri-plugin-updater` 9 态状态机（idle / checking / latest / available / downloading / downloaded / installing / unsupported / error）

## 技术栈

- 桌面壳：Tauri v2（`@tauri-apps/api` ^2 / `@tauri-apps/cli` ^2）
- 前端：React 19 + TypeScript 5.8 + Vite 7
- PDF 渲染：PDF.js（`pdfjs-dist` 6.0.227）
- PDF 页面操作与导出：pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1（中文图章字体嵌入）
- 状态管理：React useReducer / useState（reader / annotation / forms / ocr 各模块独立）
- 测试：Vitest 4.1.8 + Testing Library 16 + jsdom
- Lint / 格式：ESLint 10 + typescript-eslint 8
- 自动更新：@tauri-apps/plugin-updater 2.10.1
- Tauri 插件：dialog 2.7.1 / fs 2.5.1 / opener ^2

## 作者

**杨卫薪律师** —— 专注于技术类纠纷领域，包括知识产权、数据与 AI 相关争议，同时长期关注 AI 技术在法律实务、知识管理和专业写作中的应用。

FaroPDF 是我在法律文档处理和 AI 协作实践中沉淀出来的独立 PDF 阅读器：重点解决法律 / 商务 / 学术场景下卷宗、合同、证据、扫描件和报告的快读、批注、OCR、页面整理与签署交付。

- GitHub: [cat-xierluo](https://github.com/cat-xierluo)
- 微信：`ywxlaw`

<p>
  <img src="src/assets/wechat-qrcode.png" alt="微信二维码" width="160" height="160">
</p>

## 开发环境

本地开发需要先安装：

- Node.js 与 npm
- Rust stable toolchain
- macOS 构建还需要 Xcode 或 Xcode Command Line Tools

Tauri CLI 已作为项目开发依赖安装（`@tauri-apps/cli`），不需要额外全局安装。更完整的系统依赖可参考 [Tauri 官方前置条件](https://v2.tauri.app/start/prerequisites/)。

启动桌面开发模式：

```bash
npm install
npm run tauri dev
```

只调试前端页面时，也可以运行：

```bash
npm run dev
```

常用验证命令：

```bash
npm run typecheck   # TypeScript 类型检查
npm test            # Vitest 单测
npm run lint        # ESLint
```

## 构建

只验证前端构建：

```bash
npm run build
```

本地打包桌面应用：

```bash
npm run tauri build
```

构建产物通常位于 `src-tauri/target/release/bundle/`（macOS 产出 `.dmg` / `.app`，Windows 产出 `.exe` / `.msi`，Linux 产出 `.AppImage` / `.deb`）。

发布流程、产物矩阵、`latest.json` schema 与 keypair 管理见 `docs/RELEASE.md`。

## 贡献

欢迎通过 Issue / Pull Request 参与 FaroPDF。贡献流程、规范与 PDF 安全边界见 [`AGENTS.md`](AGENTS.md)。

## 许可

本项目基于 **Apache License 2.0** 开源，与 [Folia](https://github.com/cat-xierluo/Folia) 保持一致。完整协议见 [`LICENSE`](LICENSE)。

## 文档

- `AGENTS.md`：协作规则与 PDF 安全边界（默认不覆盖原始 PDF，高风险操作另存为新文件）
- `docs/ROADMAP.md`：项目愿景、阶段状态与 v0.1 / v0.2 / v0.3 路线图
- `docs/TASKS.md`：唯一任务源，记录待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议
- `docs/DECISIONS.md`：关键决策与工作日志（含每条 ISS 的方案、范围、验证与已知限制）
- `docs/ARCHITECTURE.md`：技术架构、模块边界与接口模型
- `docs/DESIGN.md`：视觉与交互规范
- `docs/reference/pdf-expert/`：PDF Expert 复刻的唯一证据入口、实现现状、验收门禁与重建指南
- `docs/RELEASE.md`：发布流水线、`latest.json` schema 与 keypair 管理
- `CHANGELOG.md`：用户可见变更记录（按 0.1.0-alpha.X 顺序）
