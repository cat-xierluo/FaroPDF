import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import { suggestOutputName } from "../../../shared/naming";
import type { ChapterHeadingNode } from "../autoToc";

/**
 * ISS-069 阶段 2：自动生成目录 UI 二次编辑对话框。
 *
 * 树形展示识别出的章节列表（已聚类 + 正则匹配），用户可：
 *   1) 勾选 / 取消（决定是否纳入最终 outline）
 *   2) 重命名（点击文本变为 input）
 *   3) 删除单条
 *   4) 新增空白章节（追加到最末）
 *   5) 输入输出文件名
 *
 * 简化实现：用 flat list（带 `parentIndex: number | null`）+ 深度渲染，
 * 避免递归 React 组件复杂度（与 SplitPagesDialog 同思路）。
 */

export interface AutoTocDialogProps {
  /** 初始 outline 树（来自 buildOutlineTreeFromPages） */
  initialHeadings: ChapterHeadingNode[];
  /** 加载中（PDF.js 拉 textContent 阶段） */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 默认输出文件名（不含后缀） */
  defaultFileName: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调：传入最终树 + 输出名 */
  onConfirm: (options: { tree: ChapterHeadingNode[]; outputName: string }) => void;
}

/** 扁平化节点（带父节点索引，-1 表示 root 兄弟） */
interface FlatHeading {
  /** 父节点在 flat list 中的索引；-1 = 顶级 */
  parentIndex: number;
  /** 深度（0 = 顶级，1 = 子，...） */
  depth: number;
  text: string;
  level: 1 | 2 | 3 | 4;
  pageIndex: number;
  x: number;
  y: number;
  /** 是否纳入最终 outline */
  selected: boolean;
  /** flat list 唯一 id（用于 React key） */
  id: number;
}

/** 树 → flat list（带 id + 选中态默认 true） */
function flattenTree(
  tree: ReadonlyArray<ChapterHeadingNode>,
  parentIndex = -1,
  depth = 0,
  startId = 0,
): FlatHeading[] {
  const result: FlatHeading[] = [];
  let nextId = startId;
  for (const node of tree) {
    const id = nextId;
    nextId += 1;
    const item: FlatHeading = {
      parentIndex,
      depth,
      text: node.text,
      level: node.level,
      pageIndex: node.pageIndex,
      x: node.x,
      y: node.y,
      selected: true,
      id,
    };
    result.push(item);
    result.push(...flattenTree(node.children, id, depth + 1, nextId));
    nextId = result[result.length - 1]?.id !== undefined ? result[result.length - 1]!.id + 1 : nextId;
  }
  return result;
}

/** flat list → tree（仅含 selected 节点） */
function unflattenTree(flat: ReadonlyArray<FlatHeading>): ChapterHeadingNode[] {
  // 按 id 建索引
  const nodes: ChapterHeadingNode[] = [];
  const idToNode = new Map<number, ChapterHeadingNode>();
  flat.forEach((f) => {
    if (!f.selected) return;
    const node: ChapterHeadingNode = {
      text: f.text,
      level: f.level,
      pageIndex: f.pageIndex,
      x: f.x,
      y: f.y,
      children: [],
    };
    idToNode.set(f.id, node);
  });
  // 关联父子
  flat.forEach((f) => {
    if (!f.selected) return;
    const node = idToNode.get(f.id);
    if (!node) return;
    if (f.parentIndex === -1) {
      nodes.push(node);
    } else {
      const parent = idToNode.get(f.parentIndex);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点被剔除：作为顶级
        nodes.push(node);
      }
    }
  });
  return nodes;
}

export function AutoTocDialog(props: AutoTocDialogProps): ReactElement {
  const { initialHeadings, isLoading, error, defaultFileName, onClose, onConfirm } = props;
  const [flat, setFlat] = useState<FlatHeading[]>(() => flattenTree(initialHeadings));
  const [outputName, setOutputName] = useState(() => suggestOutputName(defaultFileName, "auto-toc"));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // 初始 headings 变化时重置 flat（外部异步加载完成后）
  useEffect(() => {
    setFlat(flattenTree(initialHeadings));
  }, [initialHeadings]);

  const selectedCount = useMemo(() => flat.filter((f) => f.selected).length, [flat]);

  const handleToggle = useCallback((id: number) => {
    setFlat((prev) => prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)));
  }, []);

  const handleRename = useCallback((id: number, text: string) => {
    setFlat((prev) => prev.map((f) => (f.id === id ? { ...f, text } : f)));
  }, []);

  const handleDelete = useCallback((id: number) => {
    // 删除节点 + 全部后代（后代 parentIndex 仍指向被删节点，需一并移除）
    setFlat((prev) => {
      const toRemove = new Set<number>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of prev) {
          if (toRemove.has(f.parentIndex) && !toRemove.has(f.id)) {
            toRemove.add(f.id);
            changed = true;
          }
        }
      }
      return prev.filter((f) => !toRemove.has(f.id));
    });
  }, []);

  const handleAdd = useCallback(() => {
    setFlat((prev) => {
      const newId = prev.length === 0 ? 0 : Math.max(...prev.map((f) => f.id)) + 1;
      return [
        ...prev,
        {
          parentIndex: -1,
          depth: 0,
          text: "新章节",
          level: 1,
          pageIndex: 0,
          x: 0,
          y: 0,
          selected: true,
          id: newId,
        },
      ];
    });
  }, []);

  const handleConfirm = useCallback((): void => {
    setLocalError(null);
    const trimmed = outputName.trim();
    if (!trimmed) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    if (!trimmed.toLowerCase().endsWith(".pdf")) {
      setLocalError("输出文件名必须以 .pdf 结尾。");
      return;
    }
    if (selectedCount === 0) {
      setLocalError("至少选择 1 个章节。");
      return;
    }
    onConfirm({ tree: unflattenTree(flat), outputName: trimmed });
  }, [flat, outputName, selectedCount, onConfirm]);

  // 加载中 / 错误状态
  if (isLoading) {
    return (
      <div className="dialog-overlay" role="dialog" aria-label="自动生成目录">
        <div className="dialog-card">
          <h3 className="dialog-card__title">自动生成目录</h3>
          <p className="dialog-card__hint">正在扫描 PDF 文字层识别章节…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dialog-overlay" role="dialog" aria-label="自动生成目录">
        <div className="dialog-card">
          <h3 className="dialog-card__title">自动生成目录</h3>
          <p className="dialog-card__error" role="alert">{error}</p>
          <div className="dialog-card__actions">
            <button type="button" onClick={onClose} className="context-tool">关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-overlay" role="dialog" aria-label="自动生成目录">
      <div className="dialog-card dialog-card--wide">
        <h3 className="dialog-card__title">自动生成目录</h3>
        <p className="dialog-card__hint" data-testid="auto-toc-hint">
          已识别 {flat.length} 个章节，已选 {selectedCount} 个。
          勾选/取消决定是否纳入最终 PDF outline；点击文本可重命名；× 删除；+ 新增。
          确认后导出 <code>*-auto-toc.pdf</code> 新副本。
        </p>

        <div className="auto-toc-list" data-testid="auto-toc-list">
          {flat.length === 0 ? (
            <p className="dialog-card__hint">未识别到章节。点击「+ 新增章节」手动添加。</p>
          ) : (
            flat.map((f) => (
              <div
                key={f.id}
                className="auto-toc-row"
                data-testid={`auto-toc-row-${f.id}`}
                style={{ paddingLeft: `${f.depth * 20 + 8}px` }}
              >
                <input
                  type="checkbox"
                  checked={f.selected}
                  onChange={() => handleToggle(f.id)}
                  aria-label={`选择 ${f.text}`}
                />
                {editingId === f.id ? (
                  <input
                    type="text"
                    defaultValue={f.text}
                    autoFocus
                    onBlur={(e: ChangeEvent<HTMLInputElement>) => {
                      handleRename(f.id, e.target.value);
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRename(f.id, (e.target as HTMLInputElement).value);
                        setEditingId(null);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <span
                    className="auto-toc-row__text"
                    onClick={() => setEditingId(f.id)}
                    title="点击重命名"
                  >
                    {f.text}
                  </span>
                )}
                <span className="auto-toc-row__page" data-testid={`auto-toc-page-${f.id}`}>
                  第 {f.pageIndex + 1} 页
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  className="auto-toc-row__delete"
                  aria-label={`删除 ${f.text}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="dialog-card__field">
          <button type="button" onClick={handleAdd} className="context-tool">
            + 新增章节
          </button>
        </div>

        <div className="dialog-card__field">
          <label htmlFor="auto-toc-output">输出文件名</label>
          <input
            id="auto-toc-output"
            type="text"
            value={outputName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOutputName(e.target.value)}
          />
        </div>

        {localError ? <p className="dialog-card__error" role="alert">{localError}</p> : null}

        <div className="dialog-card__actions">
          <button type="button" onClick={onClose} className="context-tool">取消</button>
          <button
            type="button"
            onClick={handleConfirm}
            className="context-tool context-tool--primary"
            disabled={selectedCount === 0}
            data-testid="auto-toc-confirm"
          >
            生成目录
          </button>
        </div>
      </div>
    </div>
  );
}
