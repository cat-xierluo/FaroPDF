# Pages Module

负责页面旋转、删除、重排、插入、提取、合并、裁剪和页面整理预览。

所有高风险页面操作必须支持撤销或明确输出到新 PDF。

## 子模块

### pageOrganizer

页面整理工作台底座：`createPageOrganizerState` / `rotateOrganizerPages` / `deleteOrganizerPages` / `reorderOrganizerPages` / `restoreOrganizerPages` / `undoPageOrganizer` / `createPageOrganizerExportRequest` / `suggestPageOrganizerOutputPath`。默认输出 `*-organized.pdf` 的 plan-only 页面操作导出请求，当前不真实改写 PDF 页序、旋转或删除结果。

### imagePack

证据图片 / PDF 页面 A4 编排底座（ISS-018 第一版）：

- `createImagePackPlan` 接收 `ImagePackInputItem[]` 与 `ImagePackLayoutOptions`，输出 `ImagePackPlan`。
- 支持 `itemsPerPage`：1 / 2 / 3 / 4 / `auto`（`auto` 时竖版多数 → 3/页，横版多数 → 1/页）。
- 支持 `orientation`：`portrait` / `landscape` / `auto`（`auto` + `itemsPerPage=1` 时按条目方向，`itemsPerPage>=2` 时固定 landscape）。
- 支持 `margin`（默认 25pt）、`sort`（`name` / `time` / `none`，默认 `name`）。
- `suggestImagePackOutputPath` 默认生成 `*-evidence-pack.pdf`。
- 输出路径必须为绝对路径、以 `.pdf` 结尾且不能等于任何输入条目 `sourcePath`。
- 当前是 plan-only：不读取真实图片/PDF，不渲染像素，不引入新依赖。
