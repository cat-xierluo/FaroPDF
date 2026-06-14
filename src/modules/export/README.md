# Export Module

负责 pdf-lib 起步的导出引擎、表单扁平化、交付工具写入，以及批注和页面操作的第一版导出计划。

导出任务必须记录输入路径、输出路径、任务状态和失败原因。

## 第一版边界

- `pdfOperationEngine` 读取 PDF bytes，用 pdf-lib 复制页面并返回新的 PDF bytes。
- `pdfExportService` 负责路径型导出模型，要求输出路径是绝对 PDF 路径、不同于原始 PDF 路径，并通过 storage `writeNewFile` 做仅新建写入。
- 批注 sidecar 当前只转换为经过校验的 `plan-only` 导出计划和 PDF 元数据，不执行真实几何绘制。
- AcroForm 表单扁平化使用 pdf-lib `form.flatten()`。
- 页面操作当前只记录为经过页码校验的 `plan-only` 导出计划，真实旋转、删除、重排、裁剪等改写留给页面整理接入。
- 文字/图片水印、普通页码和 Bates 编号已作为导出 operation 写入新 PDF bytes；CJK 文本通过 Source Han Sans 字体路径嵌入。
- 导出模式 UI 已接入 `ExportDeliveryPanel`：文字水印、图片水印、页眉页脚、添加页码、Bates 编号和压缩共用右侧交付设置面板；页眉页脚支持应用范围和页眉 / 页脚各自的位置选择；前端 bytes 下载默认生成 `*-text-watermarked.pdf` / `*-image-watermarked.pdf` / `*-header-footer.pdf` / `*-page-numbered.pdf` / `*-bates.pdf` / `*-compressed.pdf`。
- 压缩预设在 `mode=apply` 下会调用 `compressionService`，使用压缩后 PDF bytes 替换导出工作副本；当前支持对象流保存、JPEG DCTDecode 图像重编码和目标体积检查，DPI 降采样留给后续后台 bridge。
