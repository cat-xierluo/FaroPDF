import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  ClipboardPaste,
  Copy,
  FileOutput,
  FilePlus2,
  Files,
  MoreVertical,
  RotateCw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import type { ReaderController } from "../../modules/reader";
import { createPdfOperationEngine } from "../../modules/export";
import { splitPagesByGrid } from "../../modules/pages/scanSplit";
import { trimPageMargins } from "../../modules/pages/trimMargins";
import { SplitPagesDialog } from "./SplitPagesDialog";
import { TrimMarginsDialog } from "./TrimMarginsDialog";
import "./PageOrganizerWorkspace.css";

/**
 * 页面管理多选工作台。
 *
 * 阶段 1（DEC-097）：保留原有的多选 / 风险确认 / 另存为风险提示；
 * 阶段 2（DEC-098）：在工具条新增 3 个 PDF 改写入口（插入 / 合并 / 提取），
 * 通过原生 `<dialog>` 收参后调用阶段 1 的 `pdfOperationEngine.exportPdf`，
 * 最终用 `reader.saveUpdatedBytes` 触发浏览器下载。
 */
const ACTION_LABELS = ["插入页", "附加文件", "旋转", "复制", "粘贴", "摘录", "删除"] as const;
type ActionLabel = (typeof ACTION_LABELS)[number];

const ACTION_ICONS: Record<ActionLabel, typeof FilePlus2> = {
  插入页: FilePlus2,
  附加文件: Files,
  旋转: RotateCw,
  复制: Copy,
  粘贴: ClipboardPaste,
  摘录: FileOutput,
  删除: Trash2,
};

const RISKY_ACTIONS: ReadonlySet<ActionLabel> = new Set(["删除"]);

interface PageOrganizerWorkspaceProps {
  reader: ReaderController;
}

export function PageOrganizerWorkspace({ reader }: PageOrganizerWorkspaceProps) {
  const pageCount = reader.state.document?.pageCount ?? 0;
  const pages = useMemo(
    () => Array.from({ length: Math.min(pageCount, 36) }, (_, index) => index + 1),
    [pageCount],
  );

  const [selectedPageNumbers, setSelectedPageNumbers] = useState<ReadonlySet<number>>(
    () => new Set(reader.state.document ? [reader.state.document.currentPage] : []),
  );
  const [appliedActionCount, setAppliedActionCount] = useState(0);
  const [pendingRiskAction, setPendingRiskAction] = useState<ActionLabel | null>(null);
  const [exportRiskOpen, setExportRiskOpen] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [trimDialogOpen, setTrimDialogOpen] = useState(false);
  const lastClickedPageRef = useRef<number | null>(reader.state.document?.currentPage ?? null);
  // 引擎单例：与 useFormController 同模式（每次渲染创建浪费，但 createPdfOperationEngine 轻量）
  const engineRef = useRef(createPdfOperationEngine());

  // 文档切换时清空选择
  useEffect(() => {
    setSelectedPageNumbers(new Set(reader.state.document ? [reader.state.document.currentPage] : []));
    setAppliedActionCount(0);
    setPendingRiskAction(null);
    setExportRiskOpen(false);
    setRewriteError(null);
    setInsertDialogOpen(false);
    setMergeDialogOpen(false);
    setExtractDialogOpen(false);
    setSplitDialogOpen(false);
    lastClickedPageRef.current = reader.state.document?.currentPage ?? null;
  }, [reader.state.document?.documentId]);

  const togglePage = useCallback((pageNumber: number, shiftKey: boolean) => {
    // 关键：在 click 时同步读取 ref 值（不能放进 setState updater，因为 React
    // 可能在 updater 真正运行前已经把 ref.current 改为新的 pageNumber）
    const lastClicked = lastClickedPageRef.current;
    setSelectedPageNumbers((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked !== null) {
        // shift+click：选区
        const start = Math.min(lastClicked, pageNumber);
        const end = Math.max(lastClicked, pageNumber);
        for (let p = start; p <= end; p += 1) {
          next.add(p);
        }
      } else if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
    lastClickedPageRef.current = pageNumber;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPageNumbers(new Set());
    lastClickedPageRef.current = null;
  }, []);

  const handleAction = useCallback(
    (action: ActionLabel) => {
      if (RISKY_ACTIONS.has(action)) {
        setPendingRiskAction(action);
        return;
      }
      // 占位：仅做可视化计数 + 选中态清空，真实操作在后续 worker 接入
      if (selectedPageNumbers.size > 0) {
        setAppliedActionCount((count) => count + 1);
      }
    },
    [selectedPageNumbers.size],
  );

  const confirmRiskyAction = useCallback(() => {
    if (pendingRiskAction && selectedPageNumbers.size > 0) {
      setAppliedActionCount((count) => count + 1);
    }
    setPendingRiskAction(null);
  }, [pendingRiskAction, selectedPageNumbers.size]);

  const cancelRiskyAction = useCallback(() => {
    setPendingRiskAction(null);
  }, []);

  const handleSaveAs = useCallback(() => {
    setExportRiskOpen(true);
  }, []);

  const acknowledgeExportRisk = useCallback(() => {
    setExportRiskOpen(false);
    setAppliedActionCount((count) => count + 1);
  }, []);

  const openInsertDialog = useCallback(() => {
    setRewriteError(null);
    setInsertDialogOpen(true);
  }, []);

  const openMergeDialog = useCallback(() => {
    setRewriteError(null);
    setMergeDialogOpen(true);
  }, []);

  const openExtractDialog = useCallback(() => {
    setRewriteError(null);
    setExtractDialogOpen(true);
  }, []);

  const closeInsertDialog = useCallback(() => {
    setInsertDialogOpen(false);
  }, []);

  const closeMergeDialog = useCallback(() => {
    setMergeDialogOpen(false);
  }, []);

  const closeExtractDialog = useCallback(() => {
    setExtractDialogOpen(false);
  }, []);

  const openSplitDialog = useCallback(() => {
    setRewriteError(null);
    setSplitDialogOpen(true);
  }, []);

  const closeSplitDialog = useCallback(() => {
    setSplitDialogOpen(false);
  }, []);

  const openTrimDialog = useCallback(() => {
    setRewriteError(null);
    setTrimDialogOpen(true);
  }, []);

  const closeTrimDialog = useCallback(() => {
    setTrimDialogOpen(false);
  }, []);

  const handleConfirmTrim = useCallback(
    async (options: {
      top: number;
      right: number;
      bottom: number;
      left: number;
      pageIndexes?: number[];
      outputName: string;
    }): Promise<boolean> => {
      setRewriteBusy(true);
      setRewriteError(null);
      try {
        const sourceBytes = await reader.getFileBytes();
        if (!sourceBytes) {
          throw new Error("未找到当前 PDF 的源文件字节。");
        }
        const newBytes = await trimPageMargins(new Uint8Array(sourceBytes), {
          top: options.top,
          right: options.right,
          bottom: options.bottom,
          left: options.left,
          ...(options.pageIndexes ? { pageIndexes: options.pageIndexes } : {}),
        });
        await reader.saveUpdatedBytes(newBytes, options.outputName);
        setTrimDialogOpen(false);
        return true;
      } catch (error) {
        setRewriteError(error instanceof Error ? error.message : "裁边失败。");
        return false;
      } finally {
        setRewriteBusy(false);
      }
    },
    [reader],
  );

  const handleConfirmSplit = useCallback(
    async (options: { rows: number; cols: number; pageIndexes?: number[]; outputName: string }): Promise<boolean> => {
      setRewriteBusy(true);
      setRewriteError(null);
      try {
        const sourceBytes = await reader.getFileBytes();
        if (!sourceBytes) {
          throw new Error("未找到当前 PDF 的源文件字节。");
        }
        const newBytes = await splitPagesByGrid(new Uint8Array(sourceBytes), {
          rows: options.rows,
          cols: options.cols,
          ...(options.pageIndexes ? { pageIndexes: options.pageIndexes } : {}),
        });
        await reader.saveUpdatedBytes(newBytes, options.outputName);
        setSplitDialogOpen(false);
        return true;
      } catch (error) {
        setRewriteError(error instanceof Error ? error.message : "拆页失败。");
        return false;
      } finally {
        setRewriteBusy(false);
      }
    },
    [reader],
  );

  if (!reader.state.document) {
    return (
      <main className="page-organizer" data-testid="page-organizer-workspace" aria-label="页面管理工作台">
        <section className="page-organizer__empty" aria-label="页面管理空态">
          <div className="open-dropzone__sheet" aria-hidden="true" />
          <h2>打开 PDF 后管理页面</h2>
          <p>旋转、摘录、删除和另存操作只会在文档打开后启用。</p>
        </section>
      </main>
    );
  }

  const selectedPages = Array.from(selectedPageNumbers).sort((a, b) => a - b);
  const hasSelection = selectedPageNumbers.size > 0;

  return (
    <main className="page-organizer" data-testid="page-organizer-workspace" aria-label="页面管理工作台">
      <div className="page-organizer__toolbar" role="toolbar" aria-label="页面管理工具条">
        <div className="page-organizer__actions" role="group" aria-label="页面操作">
          {ACTION_LABELS.map((action) => {
            const isDisabled = action === "粘贴" || !hasSelection;
            const Icon = ACTION_ICONS[action];
            return (
              <button
                aria-pressed={action === "删除" && hasSelection ? "true" : undefined}
                className={
                  "context-tool" +
                  (action === "删除" ? " context-tool--danger" : "") +
                  (action === "粘贴" ? " context-tool--disabled" : "")
                }
                disabled={isDisabled}
                key={action}
                onClick={() => handleAction(action)}
                type="button"
              >
                <Icon size={19} />
                <span>{action}</span>
              </button>
            );
          })}
        </div>
        <div className="page-organizer__actions page-organizer__actions--right" role="group" aria-label="历史与导出">
          <details className="page-organizer__more">
            <summary aria-label="更多页面工具" title="更多页面工具"><MoreVertical size={19} /></summary>
            <div className="page-organizer__more-menu" role="menu" aria-label="更多页面工具">
              <button className="context-tool" data-testid="page-organizer-undo" disabled={appliedActionCount === 0} onClick={() => setAppliedActionCount((count) => Math.max(0, count - 1))} role="menuitem" type="button">
                <Undo2 size={17} /><span>撤销 {appliedActionCount > 0 ? `(${appliedActionCount})` : ""}</span>
              </button>
              <button className="context-tool" data-testid="page-organizer-insert-pdf" disabled={rewriteBusy} onClick={openInsertDialog} role="menuitem" type="button">插入 PDF</button>
              <button className="context-tool" data-testid="page-organizer-merge-pdfs" disabled={rewriteBusy} onClick={openMergeDialog} role="menuitem" type="button">合并多份 PDF</button>
              <button className="context-tool" data-testid="page-organizer-extract-pages" disabled={rewriteBusy} onClick={openExtractDialog} role="menuitem" type="button">提取页码范围</button>
              <button className="context-tool" data-testid="page-organizer-split-pages" disabled={rewriteBusy} onClick={openSplitDialog} role="menuitem" type="button">扫描拆页</button>
              <button className="context-tool" data-testid="page-organizer-trim-margins" disabled={rewriteBusy} onClick={openTrimDialog} role="menuitem" type="button">裁边切</button>
              <button aria-label="另存为新 PDF" className="context-tool" data-testid="page-organizer-save-as" onClick={handleSaveAs} role="menuitem" type="button">
                <Save size={17} /><span>另存为新 PDF</span>
              </button>
            </div>
          </details>
        </div>
        {selectedPageNumbers.size > 1 ? (
          <div className="page-organizer__selection" aria-live="polite">
            <span>已选 {selectedPageNumbers.size} 页</span>
            <button className="context-tool context-tool--ghost" onClick={clearSelection} type="button">
              清除选择
            </button>
          </div>
        ) : null}
      </div>
      {rewriteError ? (
        <div className="page-organizer__error" role="alert" aria-live="assertive" data-testid="page-organizer-error">
          {rewriteError}
        </div>
      ) : null}
      <ol className="page-grid" aria-label="页面网格">
        {pages.map((page) => (
          <PageCard
            key={`${reader.state.document?.documentId ?? "none"}:${page}`}
            onToggle={togglePage}
            pageNumber={page}
            renderThumbnail={reader.renderThumbnail}
            selected={selectedPageNumbers.has(page)}
          />
        ))}
      </ol>
      {pendingRiskAction ? (
        <RiskConfirmDialog
          action={pendingRiskAction}
          onCancel={cancelRiskyAction}
          onConfirm={confirmRiskyAction}
          selectedPages={selectedPages}
        />
      ) : null}
      {exportRiskOpen ? (
        <ExportRiskDialog onAcknowledge={acknowledgeExportRisk} onClose={() => setExportRiskOpen(false)} />
      ) : null}
      {insertDialogOpen ? (
        <InsertPdfDialog
          busy={rewriteBusy}
          defaultInsertAt={pageCount}
          engine={engineRef.current}
          onBusyChange={setRewriteBusy}
          onClose={closeInsertDialog}
          onError={setRewriteError}
          onSuccess={() => {
            setInsertDialogOpen(false);
            setAppliedActionCount((count) => count + 1);
          }}
          pageCount={pageCount}
          reader={reader}
        />
      ) : null}
      {mergeDialogOpen ? (
        <MergePdfsDialog
          busy={rewriteBusy}
          engine={engineRef.current}
          onBusyChange={setRewriteBusy}
          onClose={closeMergeDialog}
          onError={setRewriteError}
          onSuccess={() => {
            setMergeDialogOpen(false);
            setAppliedActionCount((count) => count + 1);
          }}
          reader={reader}
        />
      ) : null}
      {extractDialogOpen ? (
        <ExtractPagesDialog
          busy={rewriteBusy}
          engine={engineRef.current}
          onBusyChange={setRewriteBusy}
          onClose={closeExtractDialog}
          onError={setRewriteError}
          onSuccess={() => {
            setExtractDialogOpen(false);
            setAppliedActionCount((count) => count + 1);
          }}
          reader={reader}
        />
      ) : null}
      {splitDialogOpen ? (
        <SplitPagesDialog
          defaultFileName={reader.state.document?.name ?? ""}
          selectedPageNumbers={selectedPageNumbers.size > 0 ? Array.from(selectedPageNumbers).sort((a, b) => a - b) : undefined}
          onClose={closeSplitDialog}
          onConfirm={(opts) => {
            // DEC-115 review P1-1：用 handleConfirmSplit 返回的 boolean 判断成败，
            // 不再读闭包里的 rewriteError（那是渲染时旧值，setRewriteError 要等下次渲染才反映）。
            void handleConfirmSplit(opts).then((ok) => {
              if (ok) {
                setAppliedActionCount((count) => count + 1);
              }
            });
          }}
        />
      ) : null}
      {trimDialogOpen ? (
        <TrimMarginsDialog
          defaultFileName={reader.state.document?.name ?? ""}
          selectedPageNumbers={selectedPageNumbers.size > 0 ? Array.from(selectedPageNumbers).sort((a, b) => a - b) : undefined}
          onClose={closeTrimDialog}
          onConfirm={(opts) => {
            void handleConfirmTrim(opts).then((ok) => {
              if (ok) {
                setAppliedActionCount((count) => count + 1);
              }
            });
          }}
        />
      ) : null}
    </main>
  );
}

interface PageCardProps {
  pageNumber: number;
  selected: boolean;
  onToggle: (pageNumber: number, shiftKey: boolean) => void;
  renderThumbnail: ReaderController["renderThumbnail"];
}

function PageCard({ pageNumber, selected, onToggle, renderThumbnail }: PageCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderPromiseRef = useRef<Promise<void> | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof renderThumbnail !== "function") {
      setThumbnailFailed(true);
      return;
    }
    let cancelled = false;
    setThumbnailFailed(false);
    const renderPromise = renderPromiseRef.current ?? renderThumbnail(pageNumber - 1, canvas, 174);
    renderPromiseRef.current = renderPromise;
    void renderPromise
      .then(() => {
        if (!cancelled) {
          canvas.dataset.rendered = "true";
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          renderPromiseRef.current = null;
          console.error(`[FaroPDF] 页面管理第 ${pageNumber} 页缩略图渲染失败:`, error);
          setThumbnailFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumber, renderThumbnail]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onToggle(pageNumber, event.shiftKey);
  };
  return (
    <li className="page-card-grid-item">
      <button
        aria-label={`第 ${pageNumber} 页，A4 (210 x 297 毫米)`}
        aria-pressed={selected}
        className={"page-card" + (selected ? " page-card--selected" : "")}
        data-page-number={pageNumber}
        onClick={handleClick}
        type="button"
      >
        <div className="page-card__sheet" aria-hidden="true">
          <canvas data-testid={`page-thumbnail-${pageNumber}`} ref={canvasRef} />
          {thumbnailFailed ? <span className="page-card__thumbnail-error">缩略图不可用</span> : null}
        </div>
        <span>{pageNumber}</span>
        <small>A4 (210 x 297 毫米)</small>
      </button>
    </li>
  );
}

interface RiskConfirmDialogProps {
  action: ActionLabel;
  selectedPages: number[];
  onCancel: () => void;
  onConfirm: () => void;
}

function RiskConfirmDialog({ action, selectedPages, onCancel, onConfirm }: RiskConfirmDialogProps) {
  const previewList = selectedPages.slice(0, 8).join("、");
  const more = selectedPages.length > 8 ? ` 等 ${selectedPages.length} 页` : "";
  return (
    <div className="page-organizer__dialog" role="dialog" aria-modal="true" aria-label="风险操作确认">
      <div className="page-organizer__dialog-card">
        <h2>确认 {action} 已选页面？</h2>
        <p>
          将{action} <strong>{selectedPages.length}</strong> 页（{previewList}
          {more}）。
        </p>
        <p className="page-organizer__dialog-warning">
          删除后可通过「撤销」恢复，但「另存为新 PDF」前的预览不保留原始文件副本。已打开的 PDF 不会自动覆盖。
        </p>
        <div className="page-organizer__dialog-actions">
          <button className="context-tool" onClick={onCancel} type="button">
            取消
          </button>
          <button className="context-tool context-tool--danger" onClick={onConfirm} type="button">
            确认{action}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExportRiskDialogProps {
  onAcknowledge: () => void;
  onClose: () => void;
}

function ExportRiskDialog({ onAcknowledge, onClose }: ExportRiskDialogProps) {
  return (
    <div className="page-organizer__dialog" role="dialog" aria-modal="true" aria-label="导出风险提示">
      <div className="page-organizer__dialog-card">
        <h2>另存为新 PDF</h2>
        <p>
          导出文件会保存为新 PDF，<strong>不会覆盖原始文件</strong>。
        </p>
        <p>
          输出路径可在「设置 → 保存」调整默认目录。完成导出后，原始 PDF 仍可继续阅读与编辑。
        </p>
        <div className="page-organizer__dialog-actions">
          <button className="context-tool" onClick={onClose} type="button">
            关闭
          </button>
          <button className="context-tool context-tool--primary" onClick={onAcknowledge} type="button">
            我已了解，继续
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== ISS-NEW-A 阶段 2：插入 / 合并 / 提取对话框 =====
// 三个对话框共用一个 native <dialog>（自定义遮罩样式，stage 1 已使用 .page-organizer__dialog）
// 表单字段：插入需 file + insertAt + 可选 pageRange + outputName；合并需 multi-file + outputName；
// 提取需 pageRange + outputName。提交时调用 engine.exportPdf，错误回写到工具条上方的 error 区。

interface InsertPdfDialogProps {
  busy: boolean;
  defaultInsertAt: number;
  engine: ReturnType<typeof createPdfOperationEngine>;
  pageCount: number;
  reader: ReaderController;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSuccess: () => void;
}

function InsertPdfDialog({
  busy,
  defaultInsertAt,
  engine,
  pageCount,
  reader,
  onBusyChange,
  onClose,
  onError,
  onSuccess,
}: InsertPdfDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [insertAt, setInsertAt] = useState<string>(String(defaultInsertAt));
  const [pageRange, setPageRange] = useState<string>("");
  const [outputName, setOutputName] = useState<string>(() => buildDerivedFileName(reader, "-inserted"));
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setLocalError(null);
    onError(null);
  };

  const handleConfirm = async () => {
    setLocalError(null);
    onError(null);
    if (!file) {
      setLocalError("请选择要插入的 PDF 文件。");
      return;
    }
    const insertAtNumber = Number.parseInt(insertAt, 10);
    if (!Number.isInteger(insertAtNumber) || insertAtNumber < 1) {
      setLocalError("插入位置必须是 ≥ 1 的整数。");
      return;
    }
    if (insertAtNumber > pageCount) {
      setLocalError(`插入位置超过当前文档页数（${pageCount}）。`);
      return;
    }
    const trimmedName = outputName.trim();
    if (!trimmedName) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    const sourceBytes = await reader.getFileBytes();
    if (!sourceBytes) {
      setLocalError("当前 PDF 源字节不可读。");
      return;
    }
    onBusyChange(true);
    try {
      const insertBytes = new Uint8Array(await file.arrayBuffer());
      const result = await engine.exportPdf({
        id: `insert-pages-${Date.now()}`,
        source: {
          bytes: sourceBytes,
          ...(reader.state.document?.fingerprint ? { fingerprint: reader.state.document.fingerprint } : {}),
        },
        destination: { type: "bytes" },
        operations: [
          {
            id: "insert-pages-op",
            type: "insert-pages",
            insertSource: { bytes: insertBytes, fileName: file.name },
            insertAtIndex: insertAtNumber - 1,
            ...(pageRange.trim() ? { pageRange: pageRange.trim() } : {}),
          },
        ],
        requestedAt: new Date().toISOString(),
      });
      await reader.saveUpdatedBytes(result.bytes, trimmedName);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalError(message);
      onError(`插入 PDF 失败：${message}`);
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div className="page-organizer__dialog" role="dialog" aria-modal="true" aria-label="插入 PDF">
      <div className="page-organizer__dialog-card">
        <h2>插入 PDF</h2>
        <p>选择另一份 PDF 插入到当前文档的指定位置，输出为新 PDF（不覆盖原文件）。</p>
        <form
          className="page-organizer__form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleConfirm();
          }}
        >
          <label className="page-organizer__form-field">
            <span>待插入的 PDF</span>
            <input
              accept="application/pdf,.pdf"
              data-testid="insert-pdf-file"
              disabled={busy}
              onChange={handleFileChange}
              type="file"
            />
          </label>
          <label className="page-organizer__form-field">
            <span>插入位置（1-based）</span>
            <input
              data-testid="insert-pdf-position"
              disabled={busy}
              min={1}
              onChange={(event) => setInsertAt(event.target.value)}
              type="number"
              value={insertAt}
            />
          </label>
          <label className="page-organizer__form-field">
            <span>页码范围（可选，如 1-3, 5）</span>
            <input
              data-testid="insert-pdf-range"
              disabled={busy}
              onChange={(event) => setPageRange(event.target.value)}
              placeholder="省略则插入全部页"
              type="text"
              value={pageRange}
            />
          </label>
          <label className="page-organizer__form-field">
            <span>输出文件名</span>
            <input
              data-testid="insert-pdf-output"
              disabled={busy}
              onChange={(event) => setOutputName(event.target.value)}
              type="text"
              value={outputName}
            />
          </label>
          {localError ? (
            <p className="page-organizer__form-error" role="alert" data-testid="insert-pdf-error">
              {localError}
            </p>
          ) : null}
          <div className="page-organizer__dialog-actions">
            <button className="context-tool" disabled={busy} onClick={onClose} type="button">
              取消
            </button>
          <button
            aria-label="另存为新 PDF"
            className="context-tool context-tool--primary"
              data-testid="insert-pdf-confirm"
              disabled={busy}
              type="submit"
            >
              {busy ? "处理中…" : "确认插入"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface MergePdfsDialogProps {
  busy: boolean;
  engine: ReturnType<typeof createPdfOperationEngine>;
  reader: ReaderController;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSuccess: () => void;
}

function MergePdfsDialog({
  busy,
  engine,
  reader,
  onBusyChange,
  onClose,
  onError,
  onSuccess,
}: MergePdfsDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [outputName, setOutputName] = useState<string>(() => buildDerivedFileName(reader, "-merged"));
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    setFiles(list);
    setLocalError(null);
    onError(null);
  };

  const handleConfirm = async () => {
    setLocalError(null);
    onError(null);
    if (files.length === 0) {
      setLocalError("请至少选择 1 份附加 PDF。");
      return;
    }
    const trimmedName = outputName.trim();
    if (!trimmedName) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    const sourceBytes = await reader.getFileBytes();
    if (!sourceBytes) {
      setLocalError("当前 PDF 源字节不可读。");
      return;
    }
    onBusyChange(true);
    try {
      const additionalSources = await Promise.all(
        files.map(async (file) => ({
          bytes: new Uint8Array(await file.arrayBuffer()),
          fileName: file.name,
        })),
      );
      const result = await engine.exportPdf({
        id: `merge-pdfs-${Date.now()}`,
        source: {
          bytes: sourceBytes,
          ...(reader.state.document?.fingerprint ? { fingerprint: reader.state.document.fingerprint } : {}),
        },
        additionalSources,
        destination: { type: "bytes" },
        operations: [
          {
            id: "merge-pdfs-op",
            type: "merge-pdfs",
          },
        ],
        requestedAt: new Date().toISOString(),
      });
      await reader.saveUpdatedBytes(result.bytes, trimmedName);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalError(message);
      onError(`合并 PDF 失败：${message}`);
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div className="page-organizer__dialog" role="dialog" aria-modal="true" aria-label="合并多份 PDF">
      <div className="page-organizer__dialog-card">
        <h2>合并多份 PDF</h2>
        <p>将多份 PDF 按选择顺序追加到当前文档之后，输出为新 PDF（不覆盖原文件）。</p>
        <form
          className="page-organizer__form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleConfirm();
          }}
        >
          <label className="page-organizer__form-field">
            <span>附加 PDF（多选）</span>
            <input
              accept="application/pdf,.pdf"
              data-testid="merge-pdfs-files"
              disabled={busy}
              multiple
              onChange={handleFilesChange}
              type="file"
            />
          </label>
          <label className="page-organizer__form-field">
            <span>输出文件名</span>
            <input
              data-testid="merge-pdfs-output"
              disabled={busy}
              onChange={(event) => setOutputName(event.target.value)}
              type="text"
              value={outputName}
            />
          </label>
          {localError ? (
            <p className="page-organizer__form-error" role="alert" data-testid="merge-pdfs-error">
              {localError}
            </p>
          ) : null}
          <div className="page-organizer__dialog-actions">
            <button className="context-tool" disabled={busy} onClick={onClose} type="button">
              取消
            </button>
            <button
              className="context-tool context-tool--primary"
              data-testid="merge-pdfs-confirm"
              disabled={busy}
              type="submit"
            >
              {busy ? "处理中…" : "确认合并"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ExtractPagesDialogProps {
  busy: boolean;
  engine: ReturnType<typeof createPdfOperationEngine>;
  reader: ReaderController;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSuccess: () => void;
}

function ExtractPagesDialog({
  busy,
  engine,
  reader,
  onBusyChange,
  onClose,
  onError,
  onSuccess,
}: ExtractPagesDialogProps) {
  const [pageRange, setPageRange] = useState<string>("1-1");
  const [outputName, setOutputName] = useState<string>(() => buildDerivedFileName(reader, "-extracted"));
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLocalError(null);
    onError(null);
    const trimmedRange = pageRange.trim();
    if (!trimmedRange) {
      setLocalError("页码范围不能为空。");
      return;
    }
    const trimmedName = outputName.trim();
    if (!trimmedName) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    const sourceBytes = await reader.getFileBytes();
    if (!sourceBytes) {
      setLocalError("当前 PDF 源字节不可读。");
      return;
    }
    onBusyChange(true);
    try {
      const result = await engine.exportPdf({
        id: `extract-pages-${Date.now()}`,
        source: {
          bytes: sourceBytes,
          ...(reader.state.document?.fingerprint ? { fingerprint: reader.state.document.fingerprint } : {}),
        },
        destination: { type: "bytes" },
        operations: [
          {
            id: "extract-pages-op",
            type: "extract-pages",
            pageRange: trimmedRange,
          },
        ],
        requestedAt: new Date().toISOString(),
      });
      await reader.saveUpdatedBytes(result.bytes, trimmedName);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalError(message);
      onError(`提取页码范围失败：${message}`);
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div className="page-organizer__dialog" role="dialog" aria-modal="true" aria-label="提取页码范围">
      <div className="page-organizer__dialog-card">
        <h2>提取页码范围</h2>
        <p>从当前 PDF 提取指定页码范围为新 PDF（不覆盖原文件）。</p>
        <form
          className="page-organizer__form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleConfirm();
          }}
        >
          <label className="page-organizer__form-field">
            <span>页码范围（如 2-5, 8, 11-13）</span>
            <input
              data-testid="extract-pages-range"
              disabled={busy}
              onChange={(event) => setPageRange(event.target.value)}
              placeholder="1-3, 5"
              type="text"
              value={pageRange}
            />
          </label>
          <label className="page-organizer__form-field">
            <span>输出文件名</span>
            <input
              data-testid="extract-pages-output"
              disabled={busy}
              onChange={(event) => setOutputName(event.target.value)}
              type="text"
              value={outputName}
            />
          </label>
          {localError ? (
            <p className="page-organizer__form-error" role="alert" data-testid="extract-pages-error">
              {localError}
            </p>
          ) : null}
          <div className="page-organizer__dialog-actions">
            <button className="context-tool" disabled={busy} onClick={onClose} type="button">
              取消
            </button>
            <button
              className="context-tool context-tool--primary"
              data-testid="extract-pages-confirm"
              disabled={busy}
              type="submit"
            >
              {busy ? "处理中…" : "确认提取"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** 生成默认输出文件名：`<主源 base>-<suffix>.pdf`；无主源时退化到 `untitled-<suffix>.pdf` */
function buildDerivedFileName(reader: ReaderController, suffix: string): string {
  const name = reader.getCurrentFileName() ?? "untitled.pdf";
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return `${base}${suffix}.pdf`;
}
