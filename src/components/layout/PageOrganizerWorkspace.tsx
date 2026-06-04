import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { ReaderController } from "../../modules/reader";
import "./PageOrganizerWorkspace.css";

/**
 * 页面管理多选工作台。
 *
 * 本组件只维护选择状态 + 风险确认；不接 pageOrganizer service 的真实页面变换
 * （PR scope 限定为视觉 polish；真实操作在后续导出 worker 接入）。所有按钮在
 * 多选/单选/空选间正确启用禁用，但「旋转 / 摘录 / 删除 / 另存为新 PDF」的具体
 * 行为在本 PR 只提供风险确认与可视化反馈；不修改 src-tauri 或 src/shared。
 */
const ACTION_LABELS = ["插入页", "附加文件", "旋转", "复制", "粘贴", "摘录", "删除"] as const;
type ActionLabel = (typeof ACTION_LABELS)[number];

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

  const [selectedPageNumbers, setSelectedPageNumbers] = useState<ReadonlySet<number>>(() => new Set());
  const [appliedActionCount, setAppliedActionCount] = useState(0);
  const [pendingRiskAction, setPendingRiskAction] = useState<ActionLabel | null>(null);
  const [exportRiskOpen, setExportRiskOpen] = useState(false);
  const lastClickedPageRef = useRef<number | null>(null);

  // 文档切换时清空选择
  useEffect(() => {
    setSelectedPageNumbers(new Set());
    setAppliedActionCount(0);
    setPendingRiskAction(null);
    setExportRiskOpen(false);
    lastClickedPageRef.current = null;
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

  if (!reader.state.document) {
    return (
      <main className="page-organizer" aria-label="页面管理工作台">
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
    <main className="page-organizer" aria-label="页面管理工作台">
      <div className="page-organizer__toolbar" role="toolbar" aria-label="页面管理工具条">
        <div className="page-organizer__actions" role="group" aria-label="页面操作">
          {ACTION_LABELS.map((action) => {
            const isDisabled = action === "粘贴" || !hasSelection;
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
                {action}
              </button>
            );
          })}
        </div>
        <div className="page-organizer__actions page-organizer__actions--right" role="group" aria-label="历史与导出">
          <button
            className="context-tool"
            data-testid="page-organizer-undo"
            disabled={appliedActionCount === 0}
            onClick={() => setAppliedActionCount((count) => Math.max(0, count - 1))}
            type="button"
          >
            撤销 {appliedActionCount > 0 ? `(${appliedActionCount})` : ""}
          </button>
          <button
            className="context-tool context-tool--primary"
            onClick={handleSaveAs}
            type="button"
          >
            另存为新 PDF
          </button>
        </div>
        {hasSelection ? (
          <div className="page-organizer__selection" aria-live="polite">
            <span>已选 {selectedPageNumbers.size} 页</span>
            <button className="context-tool context-tool--ghost" onClick={clearSelection} type="button">
              清除选择
            </button>
          </div>
        ) : null}
      </div>
      <ol className="page-grid" aria-label="页面网格">
        {pages.map((page) => (
          <PageCard
            key={page}
            onToggle={togglePage}
            pageNumber={page}
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
    </main>
  );
}

interface PageCardProps {
  pageNumber: number;
  selected: boolean;
  onToggle: (pageNumber: number, shiftKey: boolean) => void;
}

function PageCard({ pageNumber, selected, onToggle }: PageCardProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onToggle(pageNumber, event.shiftKey);
  };
  return (
    <li className="page-card-grid-item">
      <button
        aria-pressed={selected}
        className={"page-card" + (selected ? " page-card--selected" : "")}
        data-page-number={pageNumber}
        onClick={handleClick}
        type="button"
      >
        <div className="page-card__sheet" aria-hidden="true" />
        <span>第 {pageNumber} 页</span>
        <small>A4 (210 x 297 毫米)</small>
        {selected ? <span className="page-card__check" aria-hidden="true">✓</span> : null}
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
