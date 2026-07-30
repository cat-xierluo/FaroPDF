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
- `toolbarModel.ts`：12 种批注工具的元信息、默认色板、shape style 与工具状态原子操作（arm / disarm / 颜色 / 图章 / 形状样式）。
- `annotationPdfWriter.ts`：把全部 12 类批注按 PDF 用户空间绘制到新 PDF；形状支持线宽、实线/虚线、透明度和填充色。

UI 批注工具条、形状右栏、列表搜索和批注 overlay 由 layout 组件接入。Overlay 对齐当前页真实 bbox，并把 DOM 左上坐标转换为 PDF 左下用户空间；草稿通过 `AnnotationService` 持久化到 sidecar。
