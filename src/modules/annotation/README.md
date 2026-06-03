# Annotation Module

负责 sidecar 批注模型、批注编辑、列表跳转、批注搜索、几何/图章模板和批注摘要导出。

默认不直接覆盖原始 PDF，导出时再写入或扁平化到新 PDF。

## 当前实现

- `sidecar.ts`：生成 `.faropdf/annotations/*.annotations.json` 路径、序列化和校验 schema version 1。
- `repository.ts`：通过可替换的文本存储适配器读写 sidecar，测试中使用内存存储。
- `service.ts`：提供新增、更新、删除、按页码排序列表、组合搜索过滤和摘要模型构建。
- `summary.ts`：生成批注摘要模型，并导出 Markdown / HTML；摘要不包含真实用户文件名。
- `geometry.ts`：矩形/线段/墨迹的规整、外接盒、视口裁剪等纯函数工具。
- `search.ts`：按 query / types / pageNumbers / color 过滤批注的纯函数工具。
- `stamps.ts`：已阅、重点、待核、证据、自定义 5 套 SVG 图章模板和 XML 转义。
- `toolbarModel.ts`：9 种批注工具的元信息、默认色板和工具状态原子操作（arm / disarm / 颜色 / 图章）。

UI 批注工具条、批注 overlay 渲染、列表搜索、批注 overlay 拖拽绘制和点击跳转由 layout 组件在 `src/components/layout/` 中接入，调用 `AnnotationService`。
