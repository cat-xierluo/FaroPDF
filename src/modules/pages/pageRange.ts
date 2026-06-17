/**
 * ISS-071 m1: PDF 页码范围 DSL parser
 *
 * 统一页码字符串解析，让 OCR / 导出 / 提取 / 删除 / 拆分等场景复用同一套语法。
 * 参考 PDF-Guru `thirdparty/utils.py:7-50 parse_range()`（仅借鉴语法，独立 TypeScript 实现）。
 *
 * 输入：
 *   - "all" / "*" → 全部页
 *   - "even" → 偶数页（1-based: 2, 4, 6, ...）
 *   - "odd" → 奇数页（1-based: 1, 3, 5, ...）
 *   - "1" / "5" / "N" → 单页（"N" 是最后一页的别名）
 *   - "1,3,5" → 离散页
 *   - "1-5" / "3-N" → 连续范围
 *   - "!1-3" / "!2,4" → 反向（除指定外的所有页）
 *   - "1,3-5,!4" → 混合（先并集，再扣除）
 *
 * 输出：0-based pageIndex 数组（去重 + 升序）。
 *
 * 错误：非法输入抛 `Error("Invalid page range: <details>")`。
 */

/**
 * 仅做格式校验（不查越界 / N 解析等需要 totalPages 的部分）。
 *
 * 接受模式：all / even / odd / N / 数字 / "1,3" / "1-5" / "!1-3" / "1,3-5,!4"
 * 拒绝：包含非允许字符、嵌套范围错误、空字符串、范围 start > end（如 "3-1"）。
 *
 * 适用场景：OCR 启动时（还不知道 totalPages）做早期格式校验。
 * totalPages 边界检查由 Rust 端 / parsePageRange 解析层后续负责。
 */
const PAGE_RANGE_TOKEN_PATTERN = /^[0-9N]+$/;

export function isValidPageRangeFormat(input: string): boolean {
  if (typeof input !== "string") return false;
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;

  // 顶层关键字
  const lower = trimmed.toLowerCase();
  if (lower === "all" || trimmed === "*" || lower === "even" || lower === "odd") {
    return true;
  }

  // 拆分逗号段，每段用 "-" 分开 / 校验
  const segments = trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (segments.length === 0) return false;

  for (const seg of segments) {
    let body = seg;
    if (body.startsWith("!")) {
      body = body.slice(1);
    }
    if (body.length === 0) return false;

    const parts = body.split("-");
    if (parts.length > 2) return false; // "1-2-3" 非法

    let rangeStart: number | null = null;
    for (const part of parts) {
      if (part.length === 0) return false; // "--" / "1-" / "-5" 非法
      // token 必须是数字或 "N"
      const upper = part.toUpperCase();
      if (upper === "N") {
        if (parts.length === 2 && rangeStart === null) {
          // "N-3" 形式合法（第一页到第 3 页）
          continue;
        }
        // 单 token "N" 合法；"3-N" 中 N 作 end 也合法
        continue;
      }
      if (!PAGE_RANGE_TOKEN_PATTERN.test(part)) return false;
      const num = Number.parseInt(part, 10);
      if (rangeStart === null) {
        rangeStart = num;
      } else {
        // parts.length === 2 范围形式
        if (num < rangeStart) return false; // "3-1" 非法
      }
    }
  }

  return true;
}

export function parsePageRange(input: string, totalPages: number): number[] {
  if (!Number.isFinite(totalPages) || totalPages <= 0 || !Number.isInteger(totalPages)) {
    throw new Error(`Invalid page range: totalPages must be a positive integer, got ${totalPages}`);
  }

  const trimmed = (input ?? "").trim();
  if (trimmed === "") {
    throw new Error(`Invalid page range: empty input`);
  }

  // 解析 "N" 为 totalPages
  function resolveToken(token: string): number {
    const upper = token.trim().toUpperCase();
    if (upper === "N") {
      return totalPages;
    }
    const parsed = Number.parseInt(upper, 10);
    if (!Number.isFinite(parsed) || String(parsed) !== upper) {
      throw new Error(`Invalid page range: token "${token}" is not a positive integer or "N"`);
    }
    return parsed;
  }

  function expandRangeToken(token: string): number[] {
    const t = token.trim();
    if (t === "") {
      throw new Error(`Invalid page range: empty segment`);
    }
    const lower = t.toLowerCase();
    if (lower === "all" || t === "*") {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (lower === "even") {
      const result: number[] = [];
      for (let p = 2; p <= totalPages; p += 2) result.push(p);
      return result;
    }
    if (lower === "odd") {
      const result: number[] = [];
      for (let p = 1; p <= totalPages; p += 2) result.push(p);
      return result;
    }
    // 范围 "3-5" / "3-N"
    if (t.includes("-")) {
      const [startStr, endStr, ...extra] = t.split("-");
      if (extra.length > 0) {
        throw new Error(`Invalid page range: too many "-" in "${t}"`);
      }
      if (startStr === undefined || endStr === undefined) {
        throw new Error(`Invalid page range: malformed range "${t}"`);
      }
      const start = resolveToken(startStr);
      const end = resolveToken(endStr);
      if (start < 1 || end < 1) {
        throw new Error(`Invalid page range: pages must be >= 1 in "${t}"`);
      }
      if (start > totalPages || end > totalPages) {
        throw new Error(`Invalid page range: page > totalPages (${totalPages}) in "${t}"`);
      }
      if (start > end) {
        throw new Error(`Invalid page range: start > end in "${t}"`);
      }
      const result: number[] = [];
      for (let p = start; p <= end; p += 1) result.push(p);
      return result;
    }
    // 单页 "5" / "N"
    const page = resolveToken(t);
    if (page < 1) {
      throw new Error(`Invalid page range: page must be >= 1, got "${t}"`);
    }
    if (page > totalPages) {
      throw new Error(`Invalid page range: page ${page} > totalPages (${totalPages})`);
    }
    return [page];
  }

  // 拆分顶层 segments，按 "," 分。
  // segment 可能以 "!" 开头表示反向。
  const segments = trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new Error(`Invalid page range: no segments after split`);
  }

  const include = new Set<number>(); // 1-based
  const exclude = new Set<number>(); // 1-based
  let hadInclude = false;

  for (const seg of segments) {
    if (seg.startsWith("!")) {
      const inner = seg.slice(1).trim();
      if (inner === "") {
        throw new Error(`Invalid page range: "!" without operand`);
      }
      for (const p of expandRangeToken(inner)) {
        exclude.add(p);
      }
    } else {
      hadInclude = true;
      for (const p of expandRangeToken(seg)) {
        include.add(p);
      }
    }
  }

  // 如果所有 segment 都是反向，默认 include 全部页（!1-3 = "除 1-3 外的所有页"）
  if (!hadInclude) {
    for (let p = 1; p <= totalPages; p += 1) {
      include.add(p);
    }
  }

  // 应用 exclude
  for (const p of exclude) {
    include.delete(p);
  }

  // 转 0-based + 排序
  return Array.from(include)
    .map((p) => p - 1)
    .sort((a, b) => a - b);
}
