/**
 * ISS-060 阶段 2 后续：左右栏宽度持久化（localStorage）。
 *
 * 用法：AppShell mount 时 getPanelWidth("left"/"right") 注入 workspace grid-template-columns；
 * 用户拖拽 divider 时 setPanelWidth 持久化。
 *
 * 与 ISS-071 m3 naming.ts / signatureStore 同一模式：localStorage JSON 序列化 + 损坏数据
 * 兜底 + 类型过滤。
 */

const STORAGE_KEY = "faropdf-panel-widths";

// 默认栏宽与 surface-specific measured 值（ISS-NEW-M M2.1）：
// - 左栏 272pt：N-CROP-L3-SEARCH 的 left_outline_panel + N-ANNOTATE-TOOLBAR
//   PM 审计双重佐证（原记录 211pt 经 PM ImageMagick 审计纠正为 ~272pt）。
// - 搜索右栏 240pt；形状右栏 380pt。它们不是可互换的全局默认值。
// - 其他右栏尚未量测，沿用 320pt 基础默认，不能冒充 golden。
export const DEFAULT_LEFT_WIDTH = 272;
export const DEFAULT_RIGHT_WIDTH = 320;
export const SEARCH_RIGHT_PANEL_WIDTH = 240;
export const SHAPE_RIGHT_PANEL_WIDTH = 380;
const MIN_WIDTH = 160;
const MAX_LEFT_WIDTH = 480;
export const MAX_RIGHT_WIDTH = 560;

export type PanelSide = "left" | "right";

interface Widths {
  left?: unknown;
  right?: unknown;
}

function loadAll(): { left: number; right: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH };
    const parsed = JSON.parse(raw) as Widths;
    return {
      left: typeof parsed.left === "number" ? parsed.left : DEFAULT_LEFT_WIDTH,
      right: typeof parsed.right === "number" ? parsed.right : DEFAULT_RIGHT_WIDTH,
    };
  } catch {
    return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH };
  }
}

function persist(records: { left: number; right: number }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage 不可用（隐私模式 / 配额满），静默忽略
  }
}

function clampLeft(value: number): number {
  if (!Number.isFinite(value) || value < MIN_WIDTH) return MIN_WIDTH;
  if (value > MAX_LEFT_WIDTH) return MAX_LEFT_WIDTH;
  return value;
}

function clampRight(value: number): number {
  if (!Number.isFinite(value) || value < MIN_WIDTH) return MIN_WIDTH;
  if (value > MAX_RIGHT_WIDTH) return MAX_RIGHT_WIDTH;
  return value;
}

export function getPanelWidth(side: PanelSide): number {
  const all = loadAll();
  return side === "left" ? all.left : all.right;
}

export function setPanelWidth(side: PanelSide, width: number): void {
  const all = loadAll();
  const clamped = side === "left" ? clampLeft(width) : clampRight(width);
  const next = { ...all, [side]: clamped };
  persist(next);
}
