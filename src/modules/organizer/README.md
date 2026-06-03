# Organizer Module

负责文书整理 manifest 生成：检测 PDF 中多份文书之间的边界，为每段文书提供规范命名建议。

## 子模块

### manifestService

文书整理 manifest 服务：`createDocumentManifest` 接收页面文本数组，生成 `DocumentManifest`。

- 页级检查：每页文本长度、摘要片段
- 边界检测：基于空白页、文本长度剧变等启发式规则
- 规范命名建议：根据文本内容开头生成建议文件名
- 纯逻辑，不读取真实文件，不引入新依赖
