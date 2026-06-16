/**
 * ISS-062 阶段 2：自定义图章 localStorage 持久化层。
 *
 * 律师场景：律师上传公章 / 私章 / 印鉴的 PNG/JPG 扫描，每次批注盖章直接选用。
 * 限 4 张/用户，FIFO 淘汰最旧（避免 localStorage 撑爆）。
 */

export interface CustomStamp {
  /** 唯一 ID（uuid 或 timestamp 形式） */
  id: string;
  /** 用户起的名字（如 "李四律师印章"） */
  name: string;
  /** PNG/JPG base64 dataURL（data:image/png;base64,... 或 data:image/jpeg;base64,...） */
  image: string;
  /** 创建时间 ISO */
  createdAt: string;
}

const STORAGE_KEY = "faropdf-custom-stamps";
const MAX_STAMPS = 4;

function loadAll(): CustomStamp[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is CustomStamp =>
        typeof s === "object" && s !== null && typeof (s as CustomStamp).id === "string" && typeof (s as CustomStamp).image === "string",
    );
  } catch {
    return [];
  }
}

function persist(stamps: CustomStamp[]): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stamps));
}

/** 保存一个新自定义图章。超过 MAX_STAMPS 抛错（UI 应先提示用户删旧再上传新）。 */
export function saveCustomStamp(name: string, base64Image: string): CustomStamp {
  const existing = loadAll();
  if (existing.length >= MAX_STAMPS) {
    throw new Error(`已达上限 ${MAX_STAMPS} 张自定义图章，请先删除旧图章再上传。`);
  }
  const trimmedName = name.trim() || `图章 ${existing.length + 1}`;
  const stamp: CustomStamp = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: trimmedName,
    image: base64Image,
    createdAt: new Date().toISOString(),
  };
  persist([...existing, stamp]);
  return stamp;
}

/** 列出所有自定义图章（按 createdAt 升序）。 */
export function listCustomStamps(): CustomStamp[] {
  return loadAll().slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 按 id 删除自定义图章。id 不存在静默 noop。 */
export function deleteCustomStamp(id: string): void {
  const remaining = loadAll().filter((s) => s.id !== id);
  persist(remaining);
}

/** 测试 helper：清空所有自定义图章（仅供测试用）。 */
export function _clearCustomStamps(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export const MAX_CUSTOM_STAMPS = MAX_STAMPS;
