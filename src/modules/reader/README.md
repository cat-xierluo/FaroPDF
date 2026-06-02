# Reader Module

负责 PDF.js 文档加载、页面虚拟化、缩放、翻页和阅读状态恢复。

当前阶段只建立模块边界。功能 worker 默认修改 `src/modules/reader/` 和 `src/shared/pdf/` 中明确授权的阅读契约。
