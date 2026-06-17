/**
 * ISS-071 阶段 2：共享文件大小格式化工具
 *
 * 之前在 `src/modules/export/compressionService.ts` 的 `formatBytes` 是 local 函数。
 * 提取到 `shared/formatBytes.ts` 让 OCR 任务、压缩面板、文件统计等场景复用同一份实现。
 *
 * 行为：
 *   < 1024 字节       → "X B"
 *   < 1 MB (1MB = 1048576)    → "X.X KB"
 *   < 1 GB            → "X.X MB"
 *   >= 1 GB           → "X.XX GB"
 *   负数 / NaN        → "0 B"
 */

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < KB) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < MB) {
    return `${(bytes / KB).toFixed(1)} KB`;
  }
  if (bytes < GB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  return `${(bytes / GB).toFixed(2)} GB`;
}
