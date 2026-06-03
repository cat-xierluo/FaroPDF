# Forms 模块

负责 PDF AcroForm 表单字段读取、填写、签名图片嵌入和表单扁平化导出。

## 范围（第一版）

- 读取 AcroForm 字段（文本框、复选框、单选框、下拉框、按钮）
- 填写文本字段和复选框
- 在签名字段上嵌入签名图片（PNG / JPG）
- 输入校验和错误处理

## 共享契约

类型定义在 `src/shared/pdf/form.ts`，通过 `src/shared/index.ts` 统一导出。

## 服务层

`formService.ts` 提供 `createFormService(engine)`，依赖 pdfOperationEngine 和 pdf-lib：
- `readFormFields(pdfBytes)` → `PdfFormState`
- `fillFormField(pdfBytes, input)` → 更新后的 PDF bytes
- `signField(pdfBytes, input)` → 嵌入签名图片后的 PDF bytes

## 未来扩展

- 表单字段 UI 组件
- 手写签名绘制
- 表单批量填写
- 字段校验规则引擎
