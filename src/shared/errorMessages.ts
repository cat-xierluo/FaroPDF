/**
 * ISS-NEW-M M5：共享错误文案表。
 *
 * 从 `SecurityPanel` 的私有 `friendlyMessageForCode` 提取为共享 helper，
 * 让 reader 加载失败、SecurityPanel 加解密以及其他模块共用同一套中文用户文案，
 * 不再各处分叉。Rust 侧 `AppError::message` 已是脱敏后的中文，但 i18n 后续可按
 * `code` 切英文 / 其他语言；现阶段单语兜底：code 已知则用预设友好文案（即使 Rust
 * 误改 message），code 未知则 fallback 原 message。
 */
import type { AppError } from "./error";

/**
 * 把 AppError code 翻译成中文用户文案。
 */
export function friendlyMessageForCode(err: AppError): string {
  switch (err.code) {
    case "FileNotFound":
      return "文件不存在或路径已变更，请重新打开 PDF 后重试。";
    case "InvalidInput":
      return err.message || "输入有误，请检查后再试。";
    case "DecryptionError":
      return "密码错误或解密失败，请检查原密码后重试。";
    case "PdfParseError":
      return "PDF 解析失败，文件可能已损坏或不是有效 PDF。";
    case "IoError":
      return err.message || "文件读写失败，请检查磁盘权限。";
    case "EncryptionError":
      return "PDF 加密失败，请重试或换一份文件。";
    case "PermissionDenied":
      return "权限不足，请检查文件 / 目录权限。";
    case "NotSupported":
      return err.message || "当前 FaroPDF 版本不支持该操作。";
    case "Unknown":
    default:
      return err.message || "未知错误。";
  }
}
