# Forms 模块

负责 PDF AcroForm 表单字段读取、填写、签名图片嵌入和表单扁平化导出。

## 当前能力

- 读取 AcroForm 字段（文本框、复选框、单选框、下拉框、按钮）
- 填写文本、复选框、单选框和下拉框
- 在已有字段矩形内嵌入签名图片（PNG / JPG）
- 同一表单会话在内存工作副本上累计填写、签名与扁平化
- 每次写入只下载新 PDF，不覆盖 reader 持有的原始文件
- `tests/fixtures/forms/reference-form.pdf` 覆盖真实 UI 下载与重开验证

## 共享契约

类型定义在 `src/shared/pdf/form.ts`，通过 `src/shared/index.ts` 统一导出。

## 服务层

`formService.ts` 提供 `createFormService(engine)`，依赖 pdfOperationEngine 和 pdf-lib：
- `readFormFields(pdfBytes)` → `PdfFormState`
- `fillFormField(pdfBytes, input)` → 更新后的 PDF bytes
- `signField(pdfBytes, input)` → 嵌入签名图片后的 PDF bytes
- `flattenForm(pdfBytes)` → 不可再编辑的 PDF bytes + 字段计数摘要

`useFormController.ts` 负责会话级工作副本。首次操作从 `reader.getFileBytes()` 读取原始 bytes；后续操作只消费上一操作的输出，再通过 `reader.saveUpdatedBytes()` 下载新副本。

## 仍未覆盖

- 自由拖放签名位置（当前落在已有字段矩形）
- 字段校验规则引擎
