import { describe, expect, test } from "vitest";
import type { ReaderSession } from "../../shared/pdf/types";
import {
  createLocalStorageReaderSessionStorage,
  createMemoryReaderSessionStorage,
  normalizeReaderSession,
  READER_SESSION_STORAGE_KEY_PREFIX,
} from "./readerSessionStorage";

function makeSession(overrides: Partial<ReaderSession> = {}): ReaderSession {
  return {
    fingerprint: "fp-1",
    currentPage: 5,
    zoom: 1.25,
    viewMode: "continuous",
    rotation: 90,
    savedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  };
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("createMemoryReaderSessionStorage", () => {
  test("保存后能按 fingerprint 读取", () => {
    const storage = createMemoryReaderSessionStorage();
    const session = makeSession({ fingerprint: "fp-a" });
    storage.save(session);
    expect(storage.load("fp-a")).toEqual(session);
  });

  test("不同 fingerprint 互不干扰", () => {
    const storage = createMemoryReaderSessionStorage();
    storage.save(makeSession({ fingerprint: "fp-a", currentPage: 3 }));
    storage.save(makeSession({ fingerprint: "fp-b", currentPage: 7 }));
    expect(storage.load("fp-a")?.currentPage).toBe(3);
    expect(storage.load("fp-b")?.currentPage).toBe(7);
  });

  test("clear 删除指定 fingerprint 的会话", () => {
    const storage = createMemoryReaderSessionStorage();
    storage.save(makeSession({ fingerprint: "fp-a" }));
    storage.clear("fp-a");
    expect(storage.load("fp-a")).toBeNull();
  });
});

describe("createLocalStorageReaderSessionStorage", () => {
  test("使用前缀 key 持久化到 storage", () => {
    const backing = new MemoryStorage();
    const storage = createLocalStorageReaderSessionStorage(backing);
    const session = makeSession({ fingerprint: "fp-loc", currentPage: 12 });
    storage.save(session);

    const raw = backing.getItem(`${READER_SESSION_STORAGE_KEY_PREFIX}fp-loc`);
    expect(raw).toBe(JSON.stringify(session));
  });

  test("读取时进行 normalize，过滤非法字段", () => {
    const backing = new MemoryStorage();
    backing.setItem(
      `${READER_SESSION_STORAGE_KEY_PREFIX}fp-bad`,
      JSON.stringify({ fingerprint: "fp-bad", currentPage: "not-a-number" }),
    );
    const storage = createLocalStorageReaderSessionStorage(backing);
    expect(storage.load("fp-bad")).toBeNull();
  });

  test("JSON 解析失败时返回 null 不抛错", () => {
    const backing = new MemoryStorage();
    backing.setItem(`${READER_SESSION_STORAGE_KEY_PREFIX}fp-corrupt`, "{not valid json");
    const storage = createLocalStorageReaderSessionStorage(backing);
    expect(storage.load("fp-corrupt")).toBeNull();
  });

  test("clear 删除指定前缀的 key", () => {
    const backing = new MemoryStorage();
    const storage = createLocalStorageReaderSessionStorage(backing);
    storage.save(makeSession({ fingerprint: "fp-c" }));
    storage.clear("fp-c");
    expect(backing.getItem(`${READER_SESSION_STORAGE_KEY_PREFIX}fp-c`)).toBeNull();
  });
});

describe("normalizeReaderSession", () => {
  test("合法值原样返回", () => {
    const session = makeSession();
    expect(normalizeReaderSession(session)).toEqual(session);
  });

  test("非法 viewMode 返回 null", () => {
    expect(normalizeReaderSession({ ...makeSession(), viewMode: "bogus" })).toBeNull();
  });

  test("非法 rotation 返回 null", () => {
    expect(normalizeReaderSession({ ...makeSession(), rotation: 45 })).toBeNull();
  });

  test("currentPage/zoom 被夹紧到合法范围", () => {
    const result = normalizeReaderSession({
      ...makeSession(),
      currentPage: -5,
      zoom: 99,
    });
    expect(result?.currentPage).toBe(1);
    expect(result?.zoom).toBe(4);
  });

  test("非对象返回 null", () => {
    expect(normalizeReaderSession(null)).toBeNull();
    expect(normalizeReaderSession(42)).toBeNull();
    expect(normalizeReaderSession("string")).toBeNull();
  });
});
