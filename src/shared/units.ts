/**
 * ISS-071 m2: PDF 单位转换工具（TypeScript）
 *
 * pt / cm / mm / in 互转。参考 PDF-Guru `thirdparty/utils.py:88-99 convert_length()`
 * 仅借鉴 API shape，独立 TypeScript 实现。
 *
 * 标准换算（基于 1 pt = 1/72 inch）：
 *   1 inch = 72 pt = 2.54 cm = 25.4 mm
 *   1 cm = 28.3464567 pt
 *   1 mm = 2.83464567 pt
 *
 * 用于：导出（水印 / 页眉页脚 / 页码偏移）、页面整理（裁剪 / 缩放）、扫描预处理（margin）。
 */

export type Unit = "pt" | "cm" | "mm" | "in";

/** 1 unit 转换成 pt 的系数 */
const TO_POINT: Record<Unit, number> = {
  pt: 1,
  in: 72,
  cm: 72 / 2.54,
  mm: 72 / 25.4,
};

export function convertLength(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid length: value must be a finite number, got ${value}`);
  }
  if (!(from in TO_POINT)) {
    throw new Error(`Invalid unit: from="${from}" (expected pt | cm | mm | in)`);
  }
  if (!(to in TO_POINT)) {
    throw new Error(`Invalid unit: to="${to}" (expected pt | cm | mm | in)`);
  }
  if (from === to) {
    return value;
  }
  const valueInPt = value * TO_POINT[from];
  return valueInPt / TO_POINT[to];
}
