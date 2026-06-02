# Annotation Module

负责 sidecar 批注模型、批注编辑、列表跳转和批注摘要导出。

默认不直接覆盖原始 PDF，导出时再写入或扁平化到新 PDF。

## 当前实现

- `sidecar.ts`：生成 `.faropdf/annotations/*.annotations.json` 路径、序列化和校验 schema version 1。
- `repository.ts`：通过可替换的文本存储适配器读写 sidecar，测试中使用内存存储。
- `service.ts`：提供新增、更新、删除、按页码排序列表和摘要模型构建。
- `summary.ts`：生成批注摘要模型，并导出 Markdown / HTML；摘要不包含真实用户文件名。

UI 批注工具条、批注列表渲染和点击跳转尚未接入，后续从本模块服务层调用。
