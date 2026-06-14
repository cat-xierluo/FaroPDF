import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPdfOperationEngine } from "../../modules/export";
import {
  createPageOrganizerExportOperation,
  createPageOrganizerState,
  deleteOrganizerPages,
  reorderOrganizerPages,
  rotateOrganizerPages,
  undoPageOrganizer,
} from "../../modules/pages/pageOrganizer";
import type { ReaderController } from "../../modules/reader";
import type { PdfDocumentState, PdfPageOrganizerPage, PdfPageOrganizerState } from "../../shared";
import "./PageOrganizerWorkspace.css";

const RISK_PAGE_ACTIONS = ["删除"] as const;
type RiskPageAction = (typeof RISK_PAGE_ACTIONS)[number];
const PAGE_ACTIONS = ["旋转", ...RISK_PAGE_ACTIONS] as const;
type PageAction = (typeof PAGE_ACTIONS)[number];

interface PageOrganizerWorkspaceProps {
  reader: ReaderController;
}

interface OrganizerStatus {
  kind: "idle" | "running" | "success" | "error";
  message: string | null;
}

export function PageOrganizerWorkspace({ reader }: PageOrganizerWorkspaceProps) {
  const document = reader.state.document;
  const [organizerState, setOrganizerState] = useState<PdfPageOrganizerState | null>(() =>
    createInitialOrganizerState(document),
  );
  const [selectedPageIds, setSelectedPageIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingRiskAction, setPendingRiskAction] = useState<RiskPageAction | null>(null);
  const [exportRiskOpen, setExportRiskOpen] = useState(false);
  const [status, setStatus] = useState<OrganizerStatus>({ kind: "idle", message: null });
  const lastClickedPageIdRef = useRef<string | null>(null);
  const engine = useMemo(() => createPdfOperationEngine(), []);

  useEffect(() => {
    setOrganizerState(createInitialOrganizerState(document));
    setSelectedPageIds(new Set());
    setPendingRiskAction(null);
    setExportRiskOpen(false);
    setStatus({ kind: "idle", message: null });
    lastClickedPageIdRef.current = null;
  }, [document?.documentId, document?.fingerprint, document?.pageCount, document?.path]);

  const activePages = useMemo(() => {
    return (organizerState?.pages ?? [])
      .filter((page) => !page.deleted)
      .sort((left, right) => left.orderIndex - right.orderIndex);
  }, [organizerState]);

  const selectedPages = useMemo(() => {
    return activePages.filter((page) => selectedPageIds.has(page.id));
  }, [activePages, selectedPageIds]);

  const selectedPageIdsList = useMemo(() => selectedPages.map((page) => page.id), [selectedPages]);
  const selectedPageIndexes = useMemo(() => {
    return activePages
      .map((page, index) => (selectedPageIds.has(page.id) ? index : -1))
      .filter((index) => index >= 0);
  }, [activePages, selectedPageIds]);
  const hasSelection = selectedPages.length > 0;
  const minSelectedPageIndex = selectedPageIndexes.length > 0 ? Math.min(...selectedPageIndexes) : -1;
  const maxSelectedPageIndex = selectedPageIndexes.length > 0 ? Math.max(...selectedPageIndexes) : -1;
  const canMoveUp = hasSelection && minSelectedPageIndex > 0;
  const canMoveDown = hasSelection && maxSelectedPageIndex < activePages.length - 1;
  const undoCount = organizerState?.undoStack.length ?? 0;
  const totalPageCount = organizerState?.document.pageCount ?? document?.pageCount ?? 0;

  const togglePage = useCallback(
    (pageId: string, shiftKey: boolean) => {
      const lastClicked = lastClickedPageIdRef.current;
      setSelectedPageIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClicked !== null) {
          const startIndex = activePages.findIndex((page) => page.id === lastClicked);
          const endIndex = activePages.findIndex((page) => page.id === pageId);
          if (startIndex >= 0 && endIndex >= 0) {
            const start = Math.min(startIndex, endIndex);
            const end = Math.max(startIndex, endIndex);
            for (const page of activePages.slice(start, end + 1)) {
              next.add(page.id);
            }
            return next;
          }
        }

        if (next.has(pageId)) {
          next.delete(pageId);
        } else {
          next.add(pageId);
        }
        return next;
      });
      lastClickedPageIdRef.current = pageId;
    },
    [activePages],
  );

  const clearSelection = useCallback(() => {
    setSelectedPageIds(new Set());
    lastClickedPageIdRef.current = null;
  }, []);

  const handleRotate = useCallback(() => {
    if (selectedPageIdsList.length === 0) {
      return;
    }
    setOrganizerState((current) =>
      current
        ? rotateOrganizerPages(current, {
            pageIds: selectedPageIdsList,
            angle: 90,
          })
        : current,
    );
    setStatus({ kind: "idle", message: null });
  }, [selectedPageIdsList]);

  const handleMoveUp = useCallback(() => {
    if (!canMoveUp || selectedPageIdsList.length === 0) {
      return;
    }

    setOrganizerState((current) =>
      current
        ? reorderOrganizerPages(current, {
            pageIds: selectedPageIdsList,
            toIndex: Math.max(0, minSelectedPageIndex - 1),
          })
        : current,
    );
    setStatus({ kind: "idle", message: null });
  }, [canMoveUp, minSelectedPageIndex, selectedPageIdsList]);

  const handleMoveDown = useCallback(() => {
    if (!canMoveDown || selectedPageIdsList.length === 0) {
      return;
    }

    const remainingActiveCount = activePages.length - selectedPageIdsList.length;
    setOrganizerState((current) =>
      current
        ? reorderOrganizerPages(current, {
            pageIds: selectedPageIdsList,
            toIndex: Math.min(remainingActiveCount, minSelectedPageIndex + 1),
          })
        : current,
    );
    setStatus({ kind: "idle", message: null });
  }, [activePages.length, canMoveDown, minSelectedPageIndex, selectedPageIdsList]);

  const handleDelete = useCallback(() => {
    if (selectedPageIdsList.length === 0) {
      return;
    }
    setPendingRiskAction("删除");
  }, [selectedPageIdsList.length]);

  const confirmRiskyAction = useCallback(() => {
    if (pendingRiskAction === "删除" && selectedPageIdsList.length > 0) {
      setOrganizerState((current) =>
        current
          ? deleteOrganizerPages(current, {
              pageIds: selectedPageIdsList,
            })
          : current,
      );
      clearSelection();
      setStatus({ kind: "idle", message: null });
    }
    setPendingRiskAction(null);
  }, [clearSelection, pendingRiskAction, selectedPageIdsList]);

  const cancelRiskyAction = useCallback(() => {
    setPendingRiskAction(null);
  }, []);

  const handleUndo = useCallback(() => {
    setOrganizerState((current) => (current ? undoPageOrganizer(current) : current));
    clearSelection();
    setStatus({ kind: "idle", message: null });
  }, [clearSelection]);

  const handleSaveAs = useCallback(() => {
    setExportRiskOpen(true);
    setStatus({ kind: "idle", message: null });
  }, []);

  const acknowledgeExportRisk = useCallback(async () => {
    if (!document || !organizerState) {
      setExportRiskOpen(false);
      return;
    }

    setExportRiskOpen(false);
    setStatus({ kind: "running", message: "正在生成页面整理后的新 PDF..." });

    try {
      const sourceBytes = await reader.getFileBytes();
      if (!sourceBytes) {
        throw new Error("未找到当前 PDF 的源文件字节。");
      }

      const requestedAt = new Date().toISOString();
      const exportId = `page-organizer-${document.documentId}-${Date.now()}`;
      const operation = createPageOrganizerExportOperation(organizerState, {
        exportId,
        requestedAt,
        mode: "execute",
      });
      const result = await engine.exportPdf({
        id: exportId,
        source: {
          bytes: new Uint8Array(sourceBytes),
          ...(document.path ? { path: document.path } : {}),
          ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
        },
        destination: { type: "bytes" },
        operations: [operation],
        requestedAt,
      });
      const outputName = suggestOrganizedOutputName(reader.getCurrentFileName() ?? document.name);
      await reader.saveUpdatedBytes(result.bytes, outputName);
      setStatus({
        kind: "success",
        message: `已另存为 ${outputName}（${result.summary.outputPageCount} 页）。`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "页面整理导出失败。",
      });
    }
  }, [document, engine, organizerState, reader]);

  if (!document || !organizerState) {
    return (
      <main className="page-organizer" aria-label="页面管理工作台">
        <section className="page-organizer__empty" aria-label="页面管理空态">
          <div className="open-dropzone__sheet" aria-hidden="true" />
          <h2>打开 PDF 后管理页面</h2>
          <p>重排、旋转、删除、撤销和另存操作只会在文档打开后启用。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-organizer" aria-label="页面管理工作台">
      <div className="page-organizer__toolbar" role="toolbar" aria-label="页面管理工具条">
        <div className="page-organizer__actions" role="group" aria-label="页面操作">
          <button className="context-tool" disabled={!canMoveUp} onClick={handleMoveUp} type="button">
            上移
          </button>
          <button className="context-tool" disabled={!canMoveDown} onClick={handleMoveDown} type="button">
            下移
          </button>
          {PAGE_ACTIONS.map((action) => (
            <button
              className={"context-tool" + (action === "删除" ? " context-tool--danger" : "")}
              disabled={!hasSelection}
              key={action}
              onClick={action === "旋转" ? handleRotate : handleDelete}
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="page-organizer__summary" aria-live="polite">
          活动 {activePages.length} / {totalPageCount} 页
        </div>
        <div className="page-organizer__actions page-organizer__actions--right" role="group" aria-label="历史与导出">
          <button
            className="context-tool"
            data-testid="page-organizer-undo"
            disabled={undoCount === 0}
            onClick={handleUndo}
            type="button"
          >
            撤销 {undoCount > 0 ? `(${undoCount})` : ""}
          </button>
          <button className="context-tool context-tool--primary" onClick={handleSaveAs} type="button">
            另存为新 PDF
          </button>
        </div>
        {hasSelection ? (
          <div className="page-organizer__selection" aria-live="polite">
            <span>已选 {selectedPages.length} 页</span>
            <button className="context-tool context-tool--ghost" onClick={clearSelection} type="button">
              清除选择
            </button>
          </div>
        ) : null}
      </div>
      {status.message ? (
        <p
          className={`page-organizer__status page-organizer__status--${status.kind}`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.message}
        </p>
      ) : null}
      <ol className="page-grid" aria-label="页面网格">
        {activePages.map((page) => (
          <PageCard
            key={page.id}
            onToggle={togglePage}
            page={page}
            selected={selectedPageIds.has(page.id)}
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
    </main>
  );
}

interface PageCardProps {
  page: PdfPageOrganizerPage;
  selected: boolean;
  onToggle: (pageId: string, shiftKey: boolean) => void;
}

function PageCard({ page, selected, onToggle }: PageCardProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onToggle(page.id, event.shiftKey);
  };
  return (
    <li className="page-card-grid-item">
      <button
        aria-pressed={selected}
        className={"page-card" + (selected ? " page-card--selected" : "")}
        data-page-number={page.originalPageNumber}
        onClick={handleClick}
        type="button"
      >
        <div
          className={"page-card__sheet" + (page.rotation !== 0 ? " page-card__sheet--rotated" : "")}
          aria-hidden="true"
          style={page.rotation !== 0 ? { transform: `rotate(${page.rotation}deg)` } : undefined}
        />
        <span>第 {page.originalPageNumber} 页</span>
        <small>A4 (210 x 297 毫米)</small>
        {page.rotation !== 0 ? <small className="page-card__meta">已旋转 {page.rotation} 度</small> : null}
        {selected ? (
          <span className="page-card__check" aria-hidden="true">
            ✓
          </span>
        ) : null}
      </button>
    </li>
  );
}

interface RiskConfirmDialogProps {
  action: PageAction;
  selectedPages: PdfPageOrganizerPage[];
  onCancel: () => void;
  onConfirm: () => void;
}

function RiskConfirmDialog({ action, selectedPages, onCancel, onConfirm }: RiskConfirmDialogProps) {
  const previewList = selectedPages
    .slice(0, 8)
    .map((page) => page.originalPageNumber)
    .join("、");
  const more = selectedPages.length > 8 ? ` 等 ${selectedPages.length} 页` : "";
  return (
    <div className="page-organizer__dialog" role="dialog" aria-modal="true" aria-label="风险操作确认">
      <div className="page-organizer__dialog-card">
        <h2>确认{action}已选页面？</h2>
        <p>
          将{action} <strong>{selectedPages.length}</strong> 页（{previewList}
          {more}）。
        </p>
        <p className="page-organizer__dialog-warning">
          删除后可通过「撤销」恢复；另存前不会覆盖已打开的原始 PDF。
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
        <p>当前页面旋转、删除和顺序状态会写入新副本，原始 PDF 仍可继续阅读。</p>
        <div className="page-organizer__dialog-actions">
          <button className="context-tool" onClick={onClose} type="button">
            关闭
          </button>
          <button
            className="context-tool context-tool--primary"
            onClick={() => {
              void onAcknowledge();
            }}
            type="button"
          >
            我已了解，继续
          </button>
        </div>
      </div>
    </div>
  );
}

function createInitialOrganizerState(document: PdfDocumentState | null | undefined): PdfPageOrganizerState | null {
  if (!document || document.pageCount <= 0) {
    return null;
  }

  return createPageOrganizerState({
    pageCount: document.pageCount,
    ...(document.path ? { sourcePath: document.path } : {}),
    ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
  });
}

function suggestOrganizedOutputName(fileName: string | null): string {
  const rawName = (fileName ?? "").trim();
  const safeName = rawName.length > 0 ? rawName : "document.pdf";
  const stem = safeName.toLowerCase().endsWith(".pdf") ? safeName.slice(0, -4) : safeName;

  return `${stem || "document"}-organized.pdf`;
}
