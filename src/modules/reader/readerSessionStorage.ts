import type { PageRotation, PdfViewMode, ReaderSession } from "../../shared/pdf/types";

export const READER_SESSION_STORAGE_KEY_PREFIX = "faropdf:reader-session:";

export interface ReaderSessionStorage {
  load: (fingerprint: string) => ReaderSession | null;
  save: (session: ReaderSession) => void;
  clear: (fingerprint: string) => void;
}

const allowedViewModes = new Set<PdfViewMode>(["continuous", "single", "double", "fit-width"]);

function makeKey(fingerprint: string): string {
  return `${READER_SESSION_STORAGE_KEY_PREFIX}${fingerprint}`;
}

function isPageRotation(value: unknown): value is PageRotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

function isPdfViewMode(value: unknown): value is PdfViewMode {
  return typeof value === "string" && allowedViewModes.has(value as PdfViewMode);
}

export function normalizeReaderSession(value: unknown): ReaderSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.fingerprint !== "string" ||
    typeof record.currentPage !== "number" ||
    typeof record.zoom !== "number" ||
    !isPdfViewMode(record.viewMode) ||
    !isPageRotation(record.rotation) ||
    typeof record.savedAt !== "string"
  ) {
    return null;
  }

  return {
    fingerprint: record.fingerprint,
    currentPage: Math.max(1, Math.trunc(record.currentPage)),
    zoom: Math.min(Math.max(record.zoom, 0.25), 4),
    viewMode: record.viewMode,
    rotation: record.rotation,
    savedAt: record.savedAt,
  };
}

/** 内存版实现，可注入到 useReaderController 进行测试 */
export function createMemoryReaderSessionStorage(): ReaderSessionStorage {
  const map = new Map<string, ReaderSession>();
  return {
    load: (fingerprint) => map.get(fingerprint) ?? null,
    save: (session) => {
      map.set(session.fingerprint, session);
    },
    clear: (fingerprint) => {
      map.delete(fingerprint);
    },
  };
}

/** localStorage 版实现，需要在浏览器/支持 storage 的环境运行 */
export function createLocalStorageReaderSessionStorage(storage: Storage): ReaderSessionStorage {
  return {
    load: (fingerprint) => {
      try {
        const raw = storage.getItem(makeKey(fingerprint));
        if (!raw) {
          return null;
        }
        return normalizeReaderSession(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save: (session) => {
      try {
        storage.setItem(makeKey(session.fingerprint), JSON.stringify(session));
      } catch {
        // 忽略 storage 写入失败（隐私模式、配额超限等）
      }
    },
    clear: (fingerprint) => {
      try {
        storage.removeItem(makeKey(fingerprint));
      } catch {
        // 忽略
      }
    },
  };
}

/** 默认 storage 探测：优先 localStorage，不可用时回退到内存 */
export function createDefaultReaderSessionStorage(): ReaderSessionStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return createLocalStorageReaderSessionStorage(window.localStorage);
  }
  return createMemoryReaderSessionStorage();
}
