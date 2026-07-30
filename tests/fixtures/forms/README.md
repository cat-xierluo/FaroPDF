# AcroForm 功能夹具

`reference-form.pdf` 是由 `generate.mjs` 生成的合成 PDF，不包含真实案件或个人数据。它固定包含四个 AcroForm 字段：

- `client_name`：必填文本框
- `matter_type`：下拉框
- `accepted`：复选框
- `signature_box`：用于验证签名图片落点的文本框

`signature.png` 是 1×1 测试 PNG，只用于验证图片嵌入链路。

重新生成：

```bash
node tests/fixtures/forms/generate.mjs
```
