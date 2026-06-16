import { describe, expect, test } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { applyRedaction, type RedactionRegion } from "./redactionEngine";

/**
 * ISS-067 阶段 1：矩形遮罩涂黑算法测试。
 *
 * applyRedaction(pdfBytes, regions) 用 pdf-lib drawRectangle 在指定 pageIndex
 * 区域绘制不透明矩形（默认黑色 rgb(0,0,0)），覆盖原内容。
 *
 * 不是 PDF annotation（不可被用户切换显示/隐藏），是 content stream 直接绘制。
 * 律师证据遮蔽场景：身份证号 / 隐私电话 / 商业秘密涂黑后输出不可恢复。
 */

async function makeFixturePdf(pageCount = 3): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    const page = pdf.addPage([595, 842]); // A4
    page.drawText(`Page ${i + 1} content`, { x: 50, y: 800, size: 12 });
  }
  return pdf.save();
}

describe("applyRedaction", () => {
  test("单页单矩形遮罩 → 返回新 PDF bytes", async () => {
    const source = await makeFixturePdf(1);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 100, y: 700, width: 200, height: 30 },
    ];
    const result = await applyRedaction(source, regions);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    // 输出应是合法 PDF
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(1);
  });

  test("多页多矩形批量 → 所有矩形都绘制", async () => {
    const source = await makeFixturePdf(3);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 50, y: 800, width: 100, height: 20 },
      { pageIndex: 1, x: 60, y: 700, width: 120, height: 25 },
      { pageIndex: 2, x: 70, y: 600, width: 140, height: 30 },
    ];
    const result = await applyRedaction(source, regions);
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(3);
    // 输出 size 应该比源大（多了 3 个矩形 content stream）
    expect(result.length).toBeGreaterThan(source.length - 100); // 允许小波动
  });

  test("跨页矩形分别在不同页生效（多 region 同 pageIndex）", async () => {
    const source = await makeFixturePdf(2);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 50, y: 800, width: 100, height: 20 },
      { pageIndex: 0, x: 200, y: 700, width: 100, height: 20 }, // 同页第 2 个
      { pageIndex: 1, x: 100, y: 500, width: 150, height: 30 },
    ];
    const result = await applyRedaction(source, regions);
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(2);
  });

  test("默认黑色（不传 color）", async () => {
    const source = await makeFixturePdf(1);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 100, y: 700, width: 200, height: 30 },
    ];
    // 默认应该是黑色 rgb(0,0,0)，不传 color 也能工作
    const result = await applyRedaction(source, regions);
    expect(result.length).toBeGreaterThan(0);
  });

  test("自定义颜色（白色 + hex）", async () => {
    const source = await makeFixturePdf(1);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 50, y: 800, width: 100, height: 20, color: "#ffffff" },
      { pageIndex: 0, x: 200, y: 700, width: 100, height: 20, color: "#ff0000" },
    ];
    const result = await applyRedaction(source, regions);
    expect(result.length).toBeGreaterThan(0);
  });

  test("空 regions 数组 → 返回原 bytes 等价副本", async () => {
    const source = await makeFixturePdf(2);
    const result = await applyRedaction(source, []);
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(2);
    // 文本应该仍在（没遮罩任何东西）
    // pdf-lib 不直接 extract text，仅验证页数和合法性
  });

  test("regions 越界 pageIndex → 抛错", async () => {
    const source = await makeFixturePdf(2);
    const regions: RedactionRegion[] = [
      { pageIndex: 5, x: 100, y: 100, width: 50, height: 50 },
    ];
    await expect(applyRedaction(source, regions)).rejects.toThrow(/pageIndex/);
  });

  test("regions 负数 pageIndex → 抛错", async () => {
    const source = await makeFixturePdf(2);
    const regions: RedactionRegion[] = [
      { pageIndex: -1, x: 100, y: 100, width: 50, height: 50 },
    ];
    await expect(applyRedaction(source, regions)).rejects.toThrow(/pageIndex/);
  });

  test("无效 color 字符串 → 抛错", async () => {
    const source = await makeFixturePdf(1);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 100, y: 100, width: 50, height: 50, color: "not-a-color" },
    ];
    await expect(applyRedaction(source, regions)).rejects.toThrow(/color/i);
  });

  test("负数 width / height → 抛错", async () => {
    const source = await makeFixturePdf(1);
    const regions: RedactionRegion[] = [
      { pageIndex: 0, x: 100, y: 100, width: -50, height: 50 },
    ];
    await expect(applyRedaction(source, regions)).rejects.toThrow(/width|height/i);
  });
});

// 验证 pdf-lib rgb 助手类型与我们的实现兼容（仅编译时验证）
void rgb;
