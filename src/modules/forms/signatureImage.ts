import type { PdfSignatureImageType } from "../../shared/pdf/form";

export interface DecodedSignatureImage {
  bytes: Uint8Array;
  type: PdfSignatureImageType;
}

/** 把签名库持久化的 PNG/JPEG data URL 转回表单服务可消费的原始字节。 */
export function decodeSignatureDataUrl(dataUrl: string): DecodedSignatureImage {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("签名图片必须是有效的 PNG 或 JPG data URL。");
  }

  const decodeBase64 = globalThis.atob;
  if (typeof decodeBase64 !== "function") {
    throw new Error("当前环境无法读取签名图片。");
  }

  let binary: string;
  try {
    binary = decodeBase64(match[2]);
  } catch {
    throw new Error("签名库数据损坏，请重新新建签名。");
  }
  if (binary.length === 0) {
    throw new Error("签名图片内容为空，请重新选择签名。");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const type: PdfSignatureImageType = match[1].toLowerCase() === "png" ? "png" : "jpg";
  const isPng =
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  const isJpeg =
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;
  if ((type === "png" && !isPng) || (type === "jpg" && !isJpeg)) {
    throw new Error("签名图片内容损坏，请重新选择 PNG 或 JPG 文件。");
  }

  return {
    bytes,
    type,
  };
}
