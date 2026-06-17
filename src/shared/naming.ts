/**
 * ISS-071 m3: PDF 导出文件命名约定（TypeScript）
 *
 * 集中管理 `{stem}-{suffix}.pdf` 文件命名，避免散落在 AppShell /
 * ExportDeliveryPanel / PageOrganizerWorkspace 等模块的硬编码。
 *
 * 参考 PDF-Guru 全 Python 一致的 `{stem}-加密.pdf` / `-双层.pdf` / `-加页眉页脚.pdf`
 * 命名规范（思路），独立 TypeScript 实现，使用英文 suffix 避免文件系统 locale 问题。
 */

export type OutputSuffix =
  | "copy"                    // 另存为
  | "secured"                 // 加密
  | "unsecured"               // 移除密码
  | "watermarked"             // 文字 / 图片水印
  | "text-watermarked"        // 文字水印
  | "image-watermarked"       // 图片水印
  | "compressed"              // 压缩
  | "organized"               // 页面重排 / 旋转 / 删除
  | "annotations-flattened"   // 批注扁平化
  | "flattened"               // 表单扁平化
  | "header-footer"           // 页眉页脚
  | "page-numbered"           // 添加页码
  | "bates"                   // Bates 编号
  | "redacted"                // 矩形遮罩 / 涂黑（ISS-067）
  | "no-watermark"            // 去水印（ISS-068）
  | "metadata"                // 文档属性写回（ISS-072）
  | "cut"                     // 拆双页 / 网格切（ISS-066）
  | "signed"                  // 手写签名（ISS-070）
  | "auto-toc";               // OCR 后自动生成目录（ISS-069）

const FALLBACK_STEM = "document";

/**
 * 把原文件名拼接为 `<stem>-<suffix>.pdf`。
 *
 * - 自动 strip .pdf / .PDF 后缀（避免 `foo.pdf-secured.pdf`）
 * - 替换路径分隔符 `/` `\` 为 `-`（防止误生成子目录）
 * - 空 / 仅空白名 fallback 为 `document-<suffix>.pdf`
 * - 输出始终带 `.pdf` 后缀，小写
 */
export function suggestOutputName(originalName: string | null | undefined, suffix: OutputSuffix): string {
  const sanitized = (originalName ?? "").trim().replace(/[\\/]/g, "-");
  if (sanitized === "") {
    return `${FALLBACK_STEM}-${suffix}.pdf`;
  }
  const lower = sanitized.toLowerCase();
  const stem = lower.endsWith(".pdf") ? sanitized.slice(0, -4) : sanitized;
  const effectiveStem = stem.trim() === "" ? FALLBACK_STEM : stem;
  return `${effectiveStem}-${suffix}.pdf`;
}
