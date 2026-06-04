/**
 * ISS-007 OCR 端到端联调（DEC-044）— 前端 vitest 集成测试。
 *
 * 测试目标：把 `OcrBridgeService` / `OcrJobController` / `OcrPostProcessor`
 * 串成一条真实调用链，过程中实际执行：
 *   1. `ocrmypdf` 本地子进程：把无文字层的 fixture PDF 加工成可检索双层 PDF
 *   2. `pdftotext` 本地子进程：抽取双层 PDF 的文字层
 *   3. `OcrQualityCheckService`：根据抽取结果生成质量报告
 *
 * 测试夹具：
 *   - `tests/fixtures/ocr/scan-only-sample.pdf` 由 `generate-scan-fixture.mjs` 生成；
 *     如果缺失则测试用 `node` 重新生成（无外部依赖）。
 *
 * 跳过条件：本机缺 `ocrmypdf` 或 `pdftotext` 时跳过并打印警告，不视为失败
 * （CI 环境可能没有这些工具；本期只保证开发机可端到端跑通）。
 *
 * 范围：本测试仅触碰
 *   - `src/modules/ocr/service/bridge.ts`（OcrBridgeBackend 注入）
 *   - `src/modules/ocr/service/ocrJobController.ts`（OcrJobController 注入）
 *   - `src/modules/ocr/quality/ocrPostProcessor.ts`（OcrPostProcessor）
 *   - `src/shared/ocr/defaults.ts` / `types.ts`（契约）
 *   - `tests/fixtures/ocr/`（夹具）
 * 不触碰 `src/components/`、`src-tauri/`、`src/App.tsx`。
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createOcrPostProcessor } from "../../src/modules/ocr/quality/ocrPostProcessor";
import {
  createTauriOcrJobController,
  type OcrJobController,
} from "../../src/modules/ocr/service/ocrJobController";
import {
  createOcrBridgeService,
  type OcrBridgeBackend,
  type OcrBridgeService,
} from "../../src/modules/ocr/service/bridge";
import type { OcrCommandJob } from "../../src/shared/ocr/jobQueue";
import { prepareOcrRequest } from "../../src/shared/ocr/defaults";
import type { OcrProviderBridgeRequest } from "../../src/shared/ocr/types";

const PROJECT_ROOT = process.cwd();
const FIXTURE_DIR = resolve(PROJECT_ROOT, "tests/fixtures/ocr");
const FIXTURE_PDF = join(FIXTURE_DIR, "scan-only-sample.pdf");
const FIXTURE_GENERATOR = join(FIXTURE_DIR, "generate-scan-fixture.mjs");

const LOCAL_PROVIDER_ID = "local-ocrmypdf";

interface ToolAvailability {
  ocrmypdf: boolean;
  pdftotext: boolean;
  ocrmypdfVersion: string | null;
  pdftotextVersion: string | null;
}

let tools: ToolAvailability = {
  ocrmypdf: false,
  pdftotext: false,
  ocrmypdfVersion: null,
  pdftotextVersion: null,
};

function requireTools(): boolean {
  if (!tools.ocrmypdf || !tools.pdftotext) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ocr-e2e] skipping (ocrmypdf=${tools.ocrmypdfVersion ?? "missing"} pdftotext=${tools.pdftotextVersion ?? "missing"})`,
    );
    return false;
  }
  return true;
}

async function ensureFixture(): Promise<string> {
  if (!existsSync(FIXTURE_PDF)) {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      // 优先用 `node` 命令；如 PATH 不可用则回退到 process.execPath。
      const candidates = [
        process.env["NODE_BINARY"],
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        process.execPath,
      ].filter((value): value is string => Boolean(value));
      const spawnNode = (() => {
        let lastError: unknown = null;
        for (const candidate of candidates) {
          try {
            return { command: candidate, error: null as unknown };
          } catch (error) {
            lastError = error;
          }
        }
        return { command: null, error: lastError };
      })();
      if (!spawnNode.command) {
        rejectPromise(new Error(`未找到可执行 node：${String(spawnNode.error)}`));
        return;
      }
      const child = spawn(spawnNode.command, [FIXTURE_GENERATOR], {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk) => process.stdout.write(`[fixture] ${chunk}`));
      child.stderr.on("data", (chunk) => process.stderr.write(`[fixture] ${chunk}`));
      child.on("exit", (code) => {
        if (code === 0) resolvePromise();
        else rejectPromise(new Error(`fixture generator exit ${code}`));
      });
      child.on("error", (error) => rejectPromise(error));
    });
  }
  const stats = await stat(FIXTURE_PDF);
  return stats.size;
}

async function probeTool(command: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString("utf8");
    });
    child.on("error", (error) => rejectPromise(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise((out || err).trim());
      } else {
        rejectPromise(new Error(`${command} ${args.join(" ")} exit ${code}: ${err || out}`));
      }
    });
  });
}

interface BackendResult {
  job: OcrCommandJob;
  outputPath: string;
}

function runOcrmypdf(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ocrmypdf", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => rejectPromise(error));
    child.on("exit", (code) =>
      resolvePromise({ stdout, stderr, exitCode: code ?? -1 }),
    );
  });
}

function runPdftotext(pdfPath: string): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("pdftotext", ["-layout", pdfPath, "-"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => rejectPromise(error));
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`pdftotext exit ${code}: ${stderr}`));
    });
  });
}

function splitPages(rawText: string): string[] {
  // pdftotext 输出用 \f 分页；通常结尾会有一个或多个空 \f 段。
  // 先去掉收尾的 \f / 空白，避免最后一页被解析为额外空段。
  const trimmed = rawText.replace(/(\f|\s)+$/, "");
  const parts = trimmed.split("\f");
  return parts.length > 0 ? parts : [rawText];
}

interface JobRecord {
  job: OcrCommandJob;
  child: ReturnType<typeof spawn> | null;
}

class InMemoryOcrState {
  private readonly records = new Map<string, JobRecord>();

  upsert(record: JobRecord): void {
    this.records.set(record.job.id, record);
  }

  get(id: string): JobRecord | undefined {
    return this.records.get(id);
  }

  list(): OcrCommandJob[] {
    return Array.from(this.records.values()).map((record) => record.job);
  }

  kill(id: string): void {
    const record = this.records.get(id);
    if (record?.child && !record.child.killed) {
      record.child.kill("SIGTERM");
    }
  }
}

function makeOcrmypdfBackend(state: InMemoryOcrState, rootDir: string): OcrBridgeBackend {
  return {
    startOcr: async (request) => {
      const bridgeRequest = request as OcrProviderBridgeRequest;
      const id = `ocr-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const inputPath = bridgeRequest.inputPath;
      const outputPath = bridgeRequest.outputPath;
      const now = new Date().toISOString();

      const queued: OcrCommandJob = {
        id,
        inputPath,
        inputPathSummary: { kind: "local-pdf", fingerprint: "fixture", redacted: "[path].pdf" },
        outputPath,
        outputPathSummary: {
          kind: "local-pdf",
          fingerprint: "fixture-ocr",
          redacted: "[path]-ocr.pdf",
        },
        pageRange: bridgeRequest.pageRange,
        backend: LOCAL_PROVIDER_ID,
        providerId: bridgeRequest.provider.id,
        status: "running",
        outputStrategy: bridgeRequest.outputStrategy,
        progress: {
          stage: "running-provider",
          completedPages: 0,
          totalPages: 0,
          message: "本地 ocrmypdf 准备中…",
        },
        qualityCheck: bridgeRequest.qualityCheck,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: undefined,
        networkConsentGranted: bridgeRequest.networkConsentGranted,
      };
      state.upsert({ job: queued, child: null });

      const args = ["-l", "eng", "--output-type", "pdf", "--skip-text"];
      if (bridgeRequest.pageRange && bridgeRequest.pageRange.trim().length > 0) {
        args.push("--pages", bridgeRequest.pageRange);
      }
      args.push(inputPath, outputPath);

      // ocrmypdf 进程走 spawn 等待，但保留一个 child 句柄给 cancel。
      const result = await runOcrmypdf(args);
      if (result.exitCode !== 0) {
        const failed: OcrCommandJob = {
          ...queued,
          status: "failed",
          progress: { ...queued.progress, stage: "failed", message: result.stderr.trim() || "ocrmypdf 失败" },
          errorMessage: result.stderr.trim() || "ocrmypdf 失败",
          completedAt: new Date().toISOString(),
        };
        state.upsert({ job: failed, child: null });
        throw new Error(result.stderr.trim() || "ocrmypdf 失败");
      }

      const completed: OcrCommandJob = {
        ...queued,
        status: "completed",
        progress: { ...queued.progress, stage: "completed", message: "OCR 完成" },
        completedAt: new Date().toISOString(),
      };
      state.upsert({ job: completed, child: null });
      // 兜底：留下空 child 字段以满足后续 cancel 兼容。
      state.upsert({ job: completed, child: null });

      // 简单的副作用以保持 rootDir 写入统计（被测试读取）
      const sizeFile = join(rootDir, `${id}.completed`);
      await writeFile(sizeFile, "1", "utf8");

      return completed;
    },
  };
}

interface TestContext {
  rootDir: string;
  inputPath: string;
  outputPath: string;
  state: InMemoryOcrState;
  bridge: OcrBridgeService;
  controller: OcrJobController;
  processor: ReturnType<typeof createOcrPostProcessor>;
  inputSize: number;
}

async function setupContext(): Promise<TestContext> {
  const rootDir = await mkdtemp(join(tmpdir(), "faropdf-ocr-e2e-"));
  const inputPath = join(rootDir, "scan-input.pdf");
  const outputPath = join(rootDir, "scan-input-ocr.pdf");
  await mkdir(rootDir, { recursive: true });
  await writeFile(inputPath, await readFile(FIXTURE_PDF));

  const inputSize = (await stat(inputPath)).size;
  const state = new InMemoryOcrState();
  const bridge = createOcrBridgeService(makeOcrmypdfBackend(state, rootDir));
  const controller = createTauriOcrJobController({
    invoker: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
      switch (command) {
        case "list_ocr_jobs":
          return state.list() as unknown as T;
        case "poll_ocr_job": {
          const jobId = String(args?.["jobId"] ?? "");
          return (state.get(jobId)?.job ?? null) as unknown as T;
        }
        case "cancel_ocr_job": {
          const jobId = String(args?.["jobId"] ?? "");
          state.kill(jobId);
          return (state.get(jobId)?.job ?? null) as unknown as T;
        }
        case "extract_ocr_text": {
          const pdfPath = String(args?.["pdfPath"] ?? "");
          if (!existsSync(pdfPath)) {
            throw new Error("OCR 输出 PDF 缺失");
          }
          const text = await runPdftotext(pdfPath);
          const pages = splitPages(text).map((pageText, index) => ({
            pageIndex: index,
            text: pageText,
          }));
          const searchable = pages.filter((p) => p.text.trim().length > 0).length;
          return {
            pages,
            totalPages: pages.length,
            searchablePages: searchable,
          } as unknown as T;
        }
        default:
          throw new Error(`unsupported command in E2E stub: ${command}`);
      }
    },
  });
  const processor = createOcrPostProcessor();

  return { rootDir, inputPath, outputPath, state, bridge, controller, processor, inputSize };
}

async function teardownContext(ctx: TestContext): Promise<void> {
  await rm(ctx.rootDir, { recursive: true, force: true });
}

let fixtureSize = 0;
const contexts: TestContext[] = [];

beforeAll(async () => {
  try {
    fixtureSize = await ensureFixture();
  } catch (error) {
    throw new Error(
      `无法生成 OCR E2E fixture：${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  try {
    const ocrmypdfOut = await probeTool("ocrmypdf", ["--version"]);
    tools.ocrmypdf = true;
    tools.ocrmypdfVersion = ocrmypdfOut.split("\n")[0] ?? ocrmypdfOut;
  } catch {
    tools.ocrmypdf = false;
  }
  try {
    const pdftotextOut = await probeTool("pdftotext", ["-v"]);
    tools.pdftotext = true;
    tools.pdftotextVersion = pdftotextOut.split("\n")[0] ?? pdftotextOut;
  } catch {
    tools.pdftotext = false;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[ocr-e2e] fixture=${fixtureSize}B ocrmypdf=${tools.ocrmypdfVersion ?? "missing"} pdftotext=${tools.pdftotextVersion ?? "missing"}`,
  );
});

afterAll(async () => {
  await Promise.all(contexts.splice(0).map(teardownContext));
});

const localProviderConfig = {
  id: LOCAL_PROVIDER_ID,
  type: LOCAL_PROVIDER_ID,
  displayName: "本地 OCRmyPDF",
  enabled: true,
  requiresNetworkConsent: false,
} as const;

describe("OCR end-to-end (real ocrmypdf + pdftotext)", () => {
  test("full pipeline: validate → start → poll → extract → quality report", async () => {
    if (!requireTools()) return;
    const ctx = await setupContext();
    contexts.push(ctx);

    // 1. 通过 bridge 启动 OCR；bridge 内部会校验 + 调用 ocrmypdf。
    const job = await ctx.bridge.startOcr(
      {
        inputPath: ctx.inputPath,
        outputPath: ctx.outputPath,
        providerId: LOCAL_PROVIDER_ID,
        pageRange: "1-2",
        qualityCheck: {
          enabled: true,
          samplePages: [1, 2],
          keywords: ["OCR", "E2E", "2026"],
        },
      },
      { providers: [localProviderConfig] },
    );

    expect(job.status).toBe("completed");
    expect(job.progress.stage).toBe("completed");
    expect(existsSync(ctx.outputPath)).toBe(true);

    const outputSize = (await stat(ctx.outputPath)).size;
    expect(outputSize).toBeGreaterThan(0);

    // 2. 通过 controller 拉任务列表与轮询。
    const list = await ctx.controller.listOcrJobs();
    expect(list.map((j) => j.id)).toContain(job.id);
    const polled = await ctx.controller.pollOcrJob(job.id);
    expect(polled?.status).toBe("completed");

    // 3. 抽取文字层。
    const extraction = await ctx.controller.extractText(ctx.outputPath);
    expect(extraction.totalPages).toBe(2);
    expect(extraction.searchablePages).toBe(2);
    expect(extraction.pages[0]?.text).toContain("OCR");
    expect(extraction.pages[1]?.text).toContain("OCR");

    // 4. 跑质量检查：3 个关键词全部命中。
    const report = ctx.processor.buildReport({
      pages: extraction.pages,
      totalPages: extraction.totalPages,
      keywords: ["OCR", "E2E", "2026"],
      inputFileSizeBytes: ctx.inputSize,
      outputFileSizeBytes: outputSize,
      elapsedMs: 1500,
    });

    expect(report.searchablePages).toBe(2);
    expect(report.searchablePageRatio).toBe(1);
    expect(report.keywordHitRate).toBe(1);
    expect(report.summary.matchedKeywords).toEqual(
      expect.arrayContaining(["OCR", "E2E", "2026"]),
    );
    expect(report.passed).toBe(true);

    // 5. toOcrQualitySummary 落到 OcrJob.quality 字段。
    const summary = ctx.processor.toOcrQualitySummary(report);
    expect(summary.textPages).toBe(2);
    expect(summary.emptyTextPages).toBe(0);
    expect(summary.fileSizeRatio).toBeCloseTo(outputSize / ctx.inputSize, 2);
  }, 90_000);

  test("bridge rejects mismatched providerId before spawning ocrmypdf", async () => {
    if (!requireTools()) return;
    const ctx = await setupContext();
    contexts.push(ctx);

    await expect(
      ctx.bridge.startOcr(
        {
          inputPath: ctx.inputPath,
          outputPath: ctx.outputPath,
          providerId: "mineru", // configured providers 不包含 mineru
        },
        { providers: [localProviderConfig] },
      ),
    ).rejects.toThrow(/OCR Provider/);
  });

  test("controller sanitises backend errors so paths do not leak", async () => {
    if (!requireTools()) return;
    const leakyError = new Error("无法读取 /Users/alice/Cases, secret/file.pdf");
    const invoker = async <T>(): Promise<T> => {
      throw leakyError;
    };
    const isolatedController = createTauriOcrJobController({
      invoker: invoker as never,
    });
    await expect(
      isolatedController.startOcrJob({
        ...({
          id: "synthetic",
          inputPath: "/Users/alice/Cases, secret/source.pdf",
          inputPathSummary: { kind: "local-pdf", fingerprint: "x", redacted: "[path].pdf" },
          outputPath: "/Users/alice/Cases, secret/source-ocr.pdf",
          outputPathSummary: { kind: "local-pdf", fingerprint: "y", redacted: "[path]-ocr.pdf" },
          backend: LOCAL_PROVIDER_ID,
          providerId: LOCAL_PROVIDER_ID,
          status: "running",
          outputStrategy: "new-layered-pdf",
          progress: { stage: "running", completedPages: 0, totalPages: 0 },
          qualityCheck: { enabled: false, samplePages: [], keywords: [] },
          createdAt: "2026-06-04T00:00:00.000Z",
          updatedAt: "2026-06-04T00:00:00.000Z",
        } as unknown as OcrCommandJob),
      }),
    ).rejects.toThrow(/\[path\]/);
  });

  test("prepareOcrRequest fills outputPath and outputStrategy defaults", () => {
    const prepared = prepareOcrRequest({
      inputPath: "/tmp/sample.pdf",
      providerId: LOCAL_PROVIDER_ID,
    });
    expect(prepared.outputPath).toBe("/tmp/sample-ocr.pdf");
    expect(prepared.outputStrategy).toBe("new-layered-pdf");
    expect(prepared.qualityCheck.enabled).toBe(false);
  });
});
