# ISS-QA-02 复现与根因诊断报告

| 项 | 值 |
|---|---|
| 任务 | docs/TASKS.md ISS-QA-02（v0.2.0 打开 PDF 显示「损坏」） |
| 分支 | `fix/qa02-pdfjs-worker-repro`（base `main` @ `9d0db65`） |
| Worker | qa-pdfjs-w2 / wave-1 / w2-research（只读诊断，不改产品源码） |
| 诊断日期 | 2026-08-04 |
| pdfjs-dist | 6.0.227（`package.json:42`） |
| 结论 | **推翻**任务原始假设「worker 打包后在 tauri asset 协议下加载失败 → InvalidPDFException」（源码+产物层面证伪）。同时发现一个**独立的、真实的 prod-only worker 隐患**（与「损坏」症状无直接因果），并定位「损坏」真正根因的待验证方向。详见 §5、§6。 |

---

## 0. TL;DR

1. **原始假设被推翻（REFUTED）。** pdf.js v6.0.227 源码（`node_modules/pdfjs-dist/build/pdf.mjs`）证明：worker 加载失败只会走两条路——① 回退到主线程 fake worker（有效 PDF 仍能正常解析渲染）；② 抛出 `new Error("Setting up fake worker failed: …")`（`error.name === "Error"`）。**两条路都不可能产生 `InvalidPDFException`。** 而「损坏」这条 UI 文案**只**来自 `InvalidPDFException`（见 §4.3）。因果链两端均断。

2. **产物证据进一步证伪。** `npm run build`（vite build）**成功**，worker 资产 `dist/assets/pdf.worker-iVMkNdeB.mjs`（2.18 MB）**已正确产出**，且 bundle 内 `workerSrc` 被编译为根绝对路径字符串 `"/assets/pdf.worker-iVMkNdeB.mjs"`（见 §3.2）——在 `tauri://localhost` 下可解析、可达。即「worker 打包后加载失败」这一前提本身并不成立（资产在、路径对）。

3. **字节链路无罪且 dev/prod 同源。** PDF 字节经 Rust `fs::read → Vec<u8> → JSON number[] → new Uint8Array`（`src-tauri/src/lib.rs:89-128`、`src/modules/reader/tauriPdfFileService.ts:16-23`），无损、dev/prod 同代码，无法解释 prod-only 差异。

4. **但确有一个真实 prod-only worker 隐患（CONFIRMED-DEFECT，非「损坏」主因）。** macOS prod 下 `window.location = tauri://localhost`，其 `URL.origin` 序列化为 `"null"`（非特殊 scheme），触发 pdf.js 的 `_createCDNWrapper` blob 包装分支（`pdf.mjs:15860-15867 / 15923-15924`），dev（`http://localhost:1420`）则不触发。最坏情况下会导致 worker + fake worker 双失败 → 「未知错误。」（非「损坏」）；常见情况下退化为**主线程渲染（CPU 占用高、大 PDF 卡顿）**。建议修，但修了**不一定**解决「损坏」。

5. **「损坏」真正根因：未实机验证（NOT_VERIFIED），静态分析指向 pdfjs-dist 6.0.227 对特定 PDF 的解析回归。** 该原因在 dev/prod 同样复现，意味着任务「dev 正常 / prod 损坏」的前提本身**未经核实**（dev 可能同样失败）。需 PM 授权 `npm run tauri dev` 实机对照（≥2 份不同来源 PDF）定论（见 §6.3）。

---

## 1. 复现环境、验证范围与限制

### 1.1 已执行（证据成立）
- **Isolation Gate**：`pwd` = worktree 路径、`git branch --show-current` = `fix/qa02-pdfjs-worker-repro`、tree clean。✅
- **静态分析（只读 Read/grep）**：
  - `src/modules/reader/pdfjsWorker.ts`、`config/vite.config.ts`、`src-tauri/tauri.conf.json`、`package.json`、`src/shared/error.ts`（任务指定输入）。
  - 扩展阅读（诊断必需，只读）：`src/modules/reader/pdfReaderService.ts`、`tauriPdfFileService.ts`、`useReaderController.ts`、`index.ts`、`readerLabels.ts`、`src/shared/errorMessages.ts`、`src-tauri/src/lib.rs`、`node_modules/pdfjs-dist/build/pdf.mjs`（pdf.js v6.0.227 主线程逻辑）。
- **`npm run build`（vite build）：成功**（见 §3.1、§3.2）。`Verification Floor`（静态分析 + vite build）已满足。

### 1.2 未执行（精确原因，非失败）
| 命令 | 状态 | 精确原因 |
|---|---|---|
| `npm ci` | **NOT_RUN（被阻断）** | install guard hook `deny_by_default` + fail-closed：metadata 虽列 `npm ci` 为 authorized，但运行时 hook 要求 PM 显式 `--allow-install-command` 授权（`enforcement_source: pretool_hook_settings_wired_process_snapshot_runtime_unproven`）。返回 `DEPENDENCY_INSTALL_BLOCKED`。 |
| `npm run tauri dev` | **NOT_RUN** | 不在 hook `allowed_shell_commands` 精确白名单（仅 `git branch --show-current`/`git status --short`/`npm run build`/`pwd`）。无法实机复现。 |
| `npm run tauri build` | **NOT_RUN** | 同上，且 native release 构建慢；白名单未含。 |

> **关键澄清（`npm ci` 阻断并未影响诊断）**：`npm ci` 被阻断后，`npm run build` 仍**成功**——因为 Node 模块解析会向上回溯，从主仓 `…/FaroPDF/node_modules`（pnpm 已装，含 pdfjs-dist@6.0.227）取得全部依赖。故 vite build floor 实际达成，dist 产物可用作决定性证据。

### 1.3 其它限制
- **subagent 不可用**：派遣 Explore 子代理报 API `1211 模型不存在`（provider 侧模型不可达）。所有探索改由主进程 Read/grep 直接完成，覆盖度不受影响。
- **无法截 devtools**：tauri dev/build 不可运行，故「worker Network/Console / fake worker fallback 控制台」无实机截图；改用 pdf.js 源码控制流 + 产物结构做静态等价推断，并在每个推断处标注置信度。

---

## 2. 阅读链路与错误映射（事实链）

### 2.1 调用链
`useReaderController.openNativeFile`（`useReaderController.ts:106-151`）
→ `loadPdfFromBytes({data})`（`pdfReaderService.ts:397-442`）
→ `await adapter.configureWorker()`（设 `GlobalWorkerOptions.workerSrc`，`pdfjsWorker.ts:3-10`）
→ `adapter.getDocument({data})`（`pdfReaderService.ts:86-89`，`await import("pdfjs-dist")` 后调 `getDocument`）
→ `await loadingTask.promise`（`pdfReaderService.ts:407`）——**pdf.js 在此解析 PDF；任何加载异常在此 reject**。

### 2.2 字节来源
`tauriPdfFileService.ts:16-23`：`invoke("read_pdf_file_from_path")` → Rust 返回 `{bytes:number[], name, path}` → `new Uint8Array(result.bytes)`。Rust 侧（`lib.rs:89-128`）：`fs::read(path) → Vec<u8>`，serde 序列化为 JSON 数字数组。

### 2.3 异常 → UI 文案（决定「损坏」归属）
- `useReaderController.ts:99-102 / 147-149`：catch 内 `friendlyMessageForCode(normalizeError(error))` → `reader/loadFailed`。
- `normalizeError`（`error.ts:43-67`）：`Error` 实例先经 `classifyPdfjsException` 按 `error.name` 映射。
- `classifyPdfjsException`（`error.ts:76-87`）：**仅** `error.name === "InvalidPDFException"` → `"PdfParseError"`；`PasswordException` → 加密态；其余 → `null` → fallback `"Unknown"`。
- `friendlyMessageForCode`（`errorMessages.ts:15-37`）：
  - `"PdfParseError"` → **「PDF 解析失败，文件可能已损坏或不是有效 PDF。」** ← 用户看到的「损坏」。
  - `"Unknown"`/default → `err.message || "未知错误。"` ← **不**含「损坏」字样。

> **推论（事实）**：用户看到「损坏」**当且仅当** pdf.js 抛出的异常 `name === "InvalidPDFException"`。worker 失败类异常（`name="Error"`）会落到「未知错误。」，**不会**显示「损坏」。这条映射是后面证伪的关键开关。

---

## 3. 构建产物证据（vite build，已执行）

### 3.1 构建结果
`npm run build`（= `tsc --noEmit && vite build --config config/vite.config.ts`）**成功**，`✓ 2123 modules transformed`，`✓ built in 5.82s`。关键产物：

| 产物 | 大小 | 含义 |
|---|---|---|
| `dist/assets/pdf.worker-iVMkNdeB.mjs` | 2,187.56 KB | **`pdfjs-dist/build/pdf.worker.mjs?url` 的产出资产——存在且正确** |
| `dist/assets/pdf-CkIk37Ba.js` | 427.58 KB | pdf.js 主线程代码（`await import("pdfjs-dist")` 的 chunk） |
| `dist/assets/index-_KQSznNZ.js` | 1,738.04 KB | 应用主 bundle（含 `pdfjsWorker.ts` / `pdfReaderService.ts`） |
| `dist/index.html` | 0.46 KB | 入口；以根绝对路径 `/assets/index-_KQSznNZ.js` 引用 |

> 构建告警（与本议题无关）：`fontLoader.ts` 引入 `node:fs/url/path` 被浏览器外置化；`metadata.ts` 同时被静态/动态导入。均不影响 worker。

### 3.2 bundle 内 workerSrc 字符串（决定性）
```
$ grep -o "[^\"']*pdf\.worker-[A-Za-z0-9_-]*\.mjs[^\"']*" dist/assets/index-_KQSznNZ.js
/assets/pdf.worker-iVMkNdeB.mjs
```
即 `import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url"`（`pdfjsWorker.ts:1`）在 prod bundle 中被编译为字符串常量 **`"/assets/pdf.worker-iVMkNdeB.mjs"`**（Vite 默认 `base: "/"`，根绝对路径），随后 `GlobalWorkerOptions.workerSrc = workerSrc`（`pdfjsWorker.ts:8`）。

**可达性判定（静态）**：`tauri.conf.json` `frontendDist: "../dist"`，prod 下文档 origin 为 `tauri://localhost`，根路径 `/assets/pdf.worker-iVMkNdeB.mjs` 解析为 `tauri://localhost/assets/pdf.worker-iVMkNdeB.mjs`，由 Tauri asset 协议映射到 `dist/assets/pdf.worker-iVMkNdeB.mjs`——**资产存在、路径正确、可达**。结论：原始假设中「worker 资产打包后丢失/路径错」这一前提**不成立**。

---

## 4. pdf.js v6 源码级证据（证伪的核心）

> 源文件：`node_modules/pdfjs-dist/build/pdf.mjs`（pdf.js v6.0.227，Rollup 打包、可读）。下引行号为该文件行号。

### 4.1 worker 初始化控制流（`PDFWorker.#initialize`，`pdf.mjs:15914-15981`）
```js
// 15914
#initialize() {
  if (PDFWorker.#isWorkerDisabled || PDFWorker.#mainThreadWorkerMessageHandler) {
    this.#setupFakeWorker(); return;          // 直接走 fake worker
  }
  let { workerSrc } = PDFWorker;               // = GlobalWorkerOptions.workerSrc
  try {
    if (!PDFWorker._isSameOrigin(window.location, workerSrc)) {
      workerSrc = PDFWorker._createCDNWrapper(new URL(workerSrc, window.location).href); // 跨源→blob 包装
    }
    const worker = new Worker(workerSrc, { type: "module" });   // 15926
    worker.addEventListener("error", () => { if (!this.#webWorker) terminateEarly(); }); // 15941
    // …发 "test" 握手；成功→#resolve() 用真 worker；error/握手失败→terminateEarly()
  } catch { info("The worker has been disabled."); }
  this.#setupFakeWorker();                      // 15980 兜底
}
```
- `terminateEarly()`（15930-15939）：worker 失败时调用 `this.#setupFakeWorker()`。

### 4.2 fake worker 回退（`#setupFakeWorker`，`pdf.mjs:15982-16002` 与 `_setupFakeWorkerGlobal`，16035-16047）
```js
// 15982
#setupFakeWorker() {
  PDFWorker._setupFakeWorkerGlobal.then(WorkerMessageHandler => {
    // 成功：在主线程用 LoopbackPort 跑 WorkerMessageHandler → #resolve()，正常解析
  }).catch(reason => {
    this.#capability.reject(new Error(`Setting up fake worker failed: "${reason.message}".`)); // 16000
  });
}
// 16035
static get _setupFakeWorkerGlobal() {
  const loader = async () => {
    if (this.#mainThreadWorkerMessageHandler) return this.#mainThreadWorkerMessageHandler;
    const worker = await import(/*webpackIgnore*//*@vite-ignore*/ this.workerSrc);  // 16040-16043 主线程动态 import worker 资产
    return worker.WorkerMessageHandler;
  };
  return shadow(this, "_setupFakeWorkerGlobal", loader());
}
```
**两种结局**：
- **结局 A**：主线程 `import(workerSrc)` 成功 → fake worker 在主线程运行 → **有效 PDF 正常解析渲染**（不报错）。
- **结局 B**：`import(workerSrc)` 失败 → reject 一个普通 `Error`（`name === "Error"`，message `Setting up fake worker failed: …`）。

### 4.3 InvalidPDFException 的唯一来源
```js
// 426
class InvalidPDFException extends BaseException { constructor(msg){ super(msg, "InvalidPDFException"); } }
```
`InvalidPDFException` 由 pdf.js **文档解析器**在字节流首部找不到合法 `%PDF-` 头时抛出（与 worker 加载机制无关）。它经 worker/port 回传主线程，`loadingTask.promise` 以该异常 reject，`error.name === "InvalidPDFException"`。

### 4.4 证伪结论
| 假设的 worker 故障 | pdf.js 实际结局 | 落到 UI 的文案 |
|---|---|---|
| 真_worker spawn 失败 | `#setupFakeWorker` | 结局 A：正常渲染 / 结局 B：`Error("Setting up fake worker failed")` |
| 跨源 blob 包装后仍失败 | 同上 | 同上 |
| fake worker `import` 失败 | 结局 B：普通 `Error` | `normalizeError` → code `Unknown` → **「未知错误。」** |

**任一 worker 故障分支都到不了 `InvalidPDFException`**，因此到不了「损坏」文案。证伪完成（高置信，源码直读）。

---

## 5. dev / prod 差异分析（确认一个真实隐患）

### 5.1 唯一 prod-only 的 worker 差异：`tauri://` origin = `"null"`
- `_isSameOrigin`（`pdf.mjs:15860-15867`）：`URL.parse(window.location).origin` 为 `""` 或 `"null"` 时**直接返回 false**。
- **dev**：`window.location = http://localhost:1420`，`origin = "http://localhost:1420"`（合法）→ 与 `workerSrc` 同源 → **不包装**，`new Worker("/node_modules/.../pdf.worker.mjs", {type:"module"})` 直连 Vite dev server。✅
- **prod（macOS）**：`window.location = tauri://localhost`。`tauri` 是 WHATWG **非特殊 scheme**，`new URL("tauri://localhost").origin === "null"` → `_isSameOrigin` 返回 false → 走 `_createCDNWrapper`（`15868-15873`）：
  ```js
  this._createCDNWrapper = url => {
    const wrapper = `await import("${url}");`;
    return URL.createObjectURL(new Blob([wrapper], { type: "text/javascript" }));
  };
  ```
  即 `new Worker(blobURL, {type:"module"})`，blob 内容为 `await import("tauri://localhost/assets/pdf.worker-iVMkNdeB.mjs")`。

### 5.2 该差异的实际后果（推断，标注置信度）
- **置信度中**：blob worker（opaque origin）内 `import("tauri://…")` 在 WKWebView 可能失败 → 触发 `worker.error` → `terminateEarly` → fake worker。
- **置信度中高**：fake worker 在**主线程** `import("tauri://localhost/assets/pdf.worker-iVMkNdeB.mjs")`（同 scheme，资产存在，见 §3.2）**应能成功** → 结局 A：**主线程渲染**。
  → 后果：**不是「损坏」，而是 CPU 占用高、大 PDF（律师卷宗常数十 MB）卡顿/UI 阻塞**。
- **置信度低（最坏）**：若 WKWebView 同时阻断主线程对 `tauri://` scheme 的动态 `import()`（资产 MIME/策略问题），则结局 B：**「未知错误。」**（仍非「损坏」）。

> 以上 WKWebView 运行时行为需 `npm run tauri dev`/`build` 实机确认（当前 NOT_RUN）。但**无论哪一档**，都**不产生 InvalidPDFException**，因此都不是「损坏」主因——这一点是源码层面确定的，不依赖实机。

### 5.3 字节链路无 dev/prod 差异
`invoke("read_pdf_file_from_path")` 在 dev/prod 为同一 Tauri 二进制同一命令；`Vec<u8> → JSON number[] → new Uint8Array` 无损（每字节 0–255 精确往返）。故字节侧不存在 prod-only 腐败可能。

---

## 6. 根因判定

### 6.1 对原始假设的判定：**推翻（REFUTED）**
「pdfjs worker 打包后在 tauri asset 协议下加载失败 → InvalidPDFException」在两端均不成立：
- **产物端**：worker 资产正确产出且路径可达（§3），「加载失败」前提存疑。
- **因果端**：pdf.js 源码证明 worker 故障无法产出 `InvalidPDFException`（§4），而「损坏」仅源于 `InvalidPDFException`（§2.3）。

### 6.2 「损坏」真正根因：**NOT_VERIFIED（受实机阻断）**，静态指向 pdfjs-dist 6 解析回归
- 字节链路无损且 dev/prod 同源（§5.3）→ 排除字节腐败。
- worker 路径无法产出 InvalidPDFException（§4）→ 排除 worker。
- ⇒ 有效 PDF 却抛 `InvalidPDFException` 的剩余主因：**pdfjs-dist 6.0.227（2026 年新主版本）解析器对特定 PDF 结构的回归/不兼容**。
- 该原因**会在 dev 同样复现**——因此任务「dev 正常 / prod 损坏」的前提很可能是**未经核实**的（dev 或许同样失败，只是没测）。

### 6.3 两种可能的真实场景（需实机区分）
| 场景 | 现象 | 主因 | 决定性判据 |
|---|---|---|---|
| **A（更可能）** | dev 与 prod **都**显示「损坏」（InvalidPDFException） | pdfjs-dist 6 对该 PDF 解析回归 / 或源文件非标准 PDF | `npm run tauri dev` 打开**同一份** PDF 也「损坏」；换 ≥2 份不同来源 PDF 仍失败；降级 pdfjs-dist@5.x 复测成功 |
| **B** | prod 实为「未知错误/空白/卡顿」，被任务作者误记为「损坏」 | §5.2 的 tauri:// blob-wrapper worker 隐患 | devtools Console 出现 `Setting up fake worker failed` / worker 加载错误；UI 文案实为「未知错误。」而非「PDF 解析失败…损坏」 |

> 区分 A/B 的**唯一可靠手段**是实机 dev/prod 对照 + 看 Console（当前阻断）。建议 PM 授权后由 Wave 4 执行。

---

## 7. 修复方案候选与推荐

> 本任务只产出报告、不改源码。以下供 Wave 4 实现参考。注意：**方案 1 修的是 §5 的隐患，不保证解决「损坏」**——若实机落到场景 A，需另案处理 pdfjs-dist 兼容。

### 方案 1（推荐，针对 §5 worker 隐患）：用 `workerPort` 直传 Worker，绕开 `workerSrc` URL 解析
```ts
// src/modules/reader/pdfjsWorker.ts（示意，勿在本任务改）
GlobalWorkerOptions.workerPort = new Worker(
  new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url),
  { type: "module" },
);
```
- **为何有效**：pdf.js `PDFWorker` 构造时若拿到 `port`，走 `#initializeFromPort`（`pdf.mjs:15908-15913`），**完全跳过** `#initialize` 里的 `new Worker(workerSrc)` + `_isSameOrigin` + `_createCDNWrapper` 逻辑——从根上消除 §5.1 的 `tauri://` origin `"null"` 隐患。
- **为何对 Vite 友好**：`new Worker(new URL("…", import.meta.url), {type:"module"})` 是 Vite 一等公民，dev 直接服务、prod 正确切 chunk（本仓 `dist/assets/pdf.worker-iVMkNdeB.mjs` 已证明该资产可被 Vite 正确产出）。
- **取舍**：`workerPort` 一旦创建即常驻，需注意 `loadingTask.destroy()` 时的生命周期（pdf.js 在文档销毁时会处理 port；多文档复用需评估）。

### 方案 2：保留 `workerSrc` 字符串但显式设置 Vite `worker` 配置
`config/vite.config.ts` 增加 `worker: { format: "es" }` 等。**评价：不解决本议题**——当前问题不在 Vite worker 打包，而在 pdf.js 运行时对 `tauri://` origin 的处理。仅作为规范化补充。

### 方案 3：拷贝 worker 资产到 `public/` + 绝对 URL
绕过 `?url` 哈希。**评价：劣于方案 1**——失去内容哈希、需手动同步版本、仍受 §5.1 origin 问题困扰（除非配合 `workerPort`）。

### 针对场景 A（pdfjs-dist 6 解析回归）的修复方向（若实机确认）
- 短期：锁定 pdfjs-dist 到稳定版（如 5.x LTS）复测；
- 或对 `getDocument` 传入更宽松的解析选项 / 在 catch 内对 `InvalidPDFException` 做二次诊断（dump 首部字节核对 `%PDF-`）。
- 需 Wave 4 在实机确认 A 后定方案。

### 推荐落地顺序
1. **先实机判 A/B**（§6.3）——这是任何修复的前提，避免盲改。
2. 若 B：实施方案 1（`workerPort`）。
3. 若 A：按 pdfjs-dist 兼容路径处理；方案 1 仍建议顺带做（消除 §5 隐患、改善大 PDF 性能）。

---

## 8. 未验证项与下一步（NOT_VERIFIED 清单）

1. **实机 dev/prod 对照**：`npm run tauri dev` + `npm run tauri build` 打开同一 PDF，抓 Console。当前 NOT_RUN（白名单未含 + npm ci 被阻断）。
2. **≥2 份不同来源 PDF**：排除 pdfjs-dist 6 对特定 PDF 兼容问题（任务步骤 4）。未执行（无实机）。
3. **WKWebView 对 `tauri://` 动态 `import()` 的实际行为**（§5.2 置信度依据）。需实机 devtools。
4. **`tauri://localhost` 的 `URL.origin` 实测值**：报告依据 WHATWG 规范（非特殊 scheme → `"null"`）推断；建议实机 `console.log(new URL(location.href).origin)` 一行确认。

> 以上 4 项均需 PM 授权 `npm run tauri dev`（及必要时 `--allow-install-command` 解 npm ci）后由具备实机能力的 Wave 执行。本 worker 在只读+白名单约束下已穷尽静态可达证据。

---

## 9. 附录：关键源码行号速查

| 主题 | 位置 |
|---|---|
| worker `?url` 引入 | `src/modules/reader/pdfjsWorker.ts:1` |
| 设 `GlobalWorkerOptions.workerSrc` | `src/modules/reader/pdfjsWorker.ts:8`（`pdf.mjs:14076-14081` getter/setter） |
| vite 无 worker 配置 | `config/vite.config.ts:1-32` |
| tauri `frontendDist`/`csp` | `src-tauri/tauri.conf.json:9-10,22-24` |
| 调用链入口 | `src/modules/reader/useReaderController.ts:106-151` |
| `loadPdfFromBytes`/`getDocument` | `src/modules/reader/pdfReaderService.ts:397-442`（configureWorker@402、getDocument@403、await promise@407） |
| 字节读取（TS） | `src/modules/reader/tauriPdfFileService.ts:16-23` |
| 字节读取（Rust） | `src-tauri/src/lib.rs:89-128`（`NativePdfFileResponse`@48-53） |
| 异常分类 | `src/shared/error.ts:43-87`（InvalidPDFException→PdfParseError@78-79） |
| 「损坏」文案 | `src/shared/errorMessages.ts:23-24` |
| pdf.js worker 初始化 | `node_modules/pdfjs-dist/build/pdf.mjs:15914-15981` |
| `_isSameOrigin` / `_createCDNWrapper` | `pdf.mjs:15860-15873`、触发点 `15923-15924` |
| `new Worker(workerSrc,{type:"module"})` | `pdf.mjs:15926` |
| fake worker 回退 / 失败 reject | `pdf.mjs:15982-16002`（reject@16000） |
| fake worker `import(workerSrc)` | `pdf.mjs:16035-16047`（import@16040-16043） |
| `InvalidPDFException` 定义 | `pdf.mjs:426-428` |
| 产物 workerSrc 字符串 | `dist/assets/index-_KQSznNZ.js` → `"/assets/pdf.worker-iVMkNdeB.mjs"` |

---

*报告完。本 worker 仅产出本文件；产品源码零修改；结论与证据等级已逐项标注，未实机验证项显式列于 §8。*
