# Export Module

负责 pdf-lib 起步的导出引擎、表单扁平化、交付工具写入，以及批注和页面操作的第一版导出计划。

导出任务必须记录输入路径、输出路径、任务状态和失败原因。

## 第一版边界

- `pdfOperationEngine` 读取 PDF bytes，用 pdf-lib 复制页面并返回新的 PDF bytes。
- `pdfExportService` 负责路径型导出模型，要求输出路径是绝对 PDF 路径、不同于原始 PDF 路径，并通过 storage `writeNewFile` 做仅新建写入。
- 批注 sidecar 当前只转换为经过校验的 `plan-only` 导出计划和 PDF 元数据，不执行真实几何绘制。
- AcroForm 表单扁平化使用 pdf-lib `form.flatten()`。
- 页面操作当前只记录为经过页码校验的 `plan-only` 导出计划，真实旋转、删除、重排、裁剪等改写留给页面整理接入。
- 文字/图片水印、普通页码和 Bates 编号已作为导出 operation 写入新 PDF bytes；文字绘制使用 pdf-lib 内置 Helvetica，第一版只支持 Latin-1 文本。
- 压缩预设当前只生成 `plan-only` 摘要和警告，不执行图像重编码、降采样或对象流优化。
