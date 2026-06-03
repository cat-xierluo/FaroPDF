# doc-curator Changelog

## 0.1.0 - 2026-06-03

- 首版发布。
- 体检脚本 `scan.sh`：检查 `docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` / `CHANGELOG.md` / `README.md` / `AGENTS.md` 的硬性 / 自适应 / 软提示项。
- 首跑基线脚本 `first-baseline.sh`：测量各文件大小并写入 `state.json`。
- Maintenance PR 脚本 `maintenance-pr.sh`：在工作区干净时自动 trim 进度日志并提 PR。
- 配置：`config/faropdf.yaml` 声明监控文件、规则集和种子阈值。
- 状态：`state.json` 跟踪基线和历史。
- 触发：Agent 在 `gh pr create` 后 / `gh pr merge` 后 / 完成 ISS 汇报前主动调起；无 hooks 依赖。
