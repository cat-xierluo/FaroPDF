/**
 * ISS-070 阶段 2 / ISS-060 阶段 2 第二步：手写签名 localStorage 持久化层。
 *
 * 设计与 src/modules/annotation/customStampStore 同款（同一作者保持一致约定），
 * 律师签字签材料后可重复使用：登录用户、客户档案归档、和解协议批量签等。
 *
 * 上限 4 张 / 用户（FIFO 强制，超过抛错让 UI 提示用户先删旧再画新）。
 */

export interface SignatureRecord {
  /** 唯一 ID（timestamp + random 形式） */
  id: string;
  /** 用户起的名字（如 "张律师常规签名"） */
  name: string;
  /** PNG base64 dataURL（data:image/png;base64,...） */
  image: string;
  /** 创建时间 ISO */
  createdAt: string;
}

const STORAGE_KEY = "faropdf-signatures";
const MAX_SIGNATURES = 4;

function loadAll(): SignatureRecord[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SignatureRecord =>
        typeof s === "object" && s !== null && typeof (s as SignatureRecord).id === "string" && typeof (s as SignatureRecord).image === "string",
    );
  } catch {
    return [];
  }
}

function persist(records: SignatureRecord[]): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** 保存一个新签名。超过 MAX_SIGNATURES 抛错。 */
export function saveSignature(name: string, base64Image: string): SignatureRecord {
  const existing = loadAll();
  if (existing.length >= MAX_SIGNATURES) {
    throw new Error(`已达上限 ${MAX_SIGNATURES} 个签名，请先删除旧签名再画新签名。`);
  }
  const trimmedName = name.trim() || `签名 ${existing.length + 1}`;
  const record: SignatureRecord = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: trimmedName,
    image: base64Image,
    createdAt: new Date().toISOString(),
  };
  persist([...existing, record]);
  return record;
}

/** 列出所有签名（按 createdAt 升序）。 */
export function listSignatures(): SignatureRecord[] {
  return loadAll().slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 按 id 删除签名。id 不存在静默 noop。 */
export function deleteSignature(id: string): void {
  const remaining = loadAll().filter((s) => s.id !== id);
  persist(remaining);
}

/** 测试 helper：清空所有签名。 */
export function _clearSignatures(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export const MAX_USER_SIGNATURES = MAX_SIGNATURES;
