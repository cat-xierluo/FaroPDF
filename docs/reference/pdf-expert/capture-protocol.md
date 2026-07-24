# PDF Expert 规范化采集协议（M1）

本文件固化 PDF Expert 高保真复刻 M1 阶段「重采集 + 量测 + accepted-golden 准入」的可复现条件。任何 M1 worker 在同一参考状态下复采两次、做 reference-vs-reference 稳定性 diff、准入 golden 时，必须遵守下列全部参数。M2 的 FaroPDF-vs-reference 回归验证器另用本协议的 fixture/主题/窗口/crop，但不复用本文件的参考采集步骤。

任务状态与顺序仍以 `docs/TASKS.md` ISS-NEW-M 为准；本文件不分配任务。

## 固定环境参数

| 参数 | 值 | 说明 |
| --- | --- | --- |
| 应用 | PDF Expert 3.9.2（`/Applications/PDF Expert.app`） | 实机版本，manifest `observed_version` 已更正；不得用历史误标的 25.2.1 |
| Fixture | `tests/fixtures/expert/reference.pdf`（5 页 A4 文字层） | 受控、入仓、确定性生成；详见 `tests/fixtures/expert/README.md` |
| 主题 | macOS 深色（Dark；2026-07-24 补采实测） | 本批次以实机当前外观为准；若未来切换浅色，必须另建 capture batch，不得与本批次混用 |
| 缩放 | 100%（Fit/Actual Size） | 打开 fixture 后按 Cmd+1 / 视图菜单归一 |
| 显示器 | 主屏（3024×1964 Retina，本机） | 单主屏采集；副屏不参与 |
| 窗口位置 | `{x: 200, y: 120}` | 留出顶部菜单栏（y≥0）与左侧 |
| 窗口尺寸 | `{w: 1280, h: 832}` | 固定逻辑尺寸，crop 以此为基准 |
| Retina | screencapture 默认 2×，crop 后像素 = 逻辑×2 | 量测记录「逻辑 pt / 物理 px」两套 |

## 采集流程（每个参考状态）

```
1. 关闭并重开 PDF Expert（保证无残留状态）
2. open -a "PDF Expert" tests/fixtures/expert/reference.pdf
3. osascript 把 window 1 固定到 {200,120} + {1280,832}，delay 1.5
4. 归一状态：Cmd+1（100%）+ 视图重置
5. 触发目标状态（见下表）
6. screencapture -x -m 捕获 Retina 全屏（或使用 `screencapture -l` 捕获窗口）
7. 若使用全屏，按窗口物理偏移 `{400,240}` 和尺寸 `{2560,1664}` 用 ImageMagick `-crop 2560x1664+400+240 +repage` 生成 window-only crop；不要用无 offset 的 `sips -c` 冒充窗口 crop
8. 重复 1–7 第二次（run=b），用于稳定性 diff
9. perceptual diff(a,b) → 记录工具/阈值/相似度
10. diff 通过 → 人工 bbox 量测 → 准入 golden/G<NN>-<state>.png
```

安全铁律（强制，源自 computer-use skill）：每次 keystroke/cliclick 前 verify frontmost=PDF Expert；不裸 keystroke 系统组合键（Cmd+W/Q/H 等），改用进程内对象操作或菜单 AX route；采集后还原窗口位置、发 Escape 解除工具态。

## 触发步骤（四状态）

| capture id | 状态 | 触发步骤 |
| --- | --- | --- |
| G01 | read default | 打开 fixture，默认阅读态，左栏折叠，不进入批注/编辑 |
| G02 | thumbnails | read 态下点左栏缩略图按钮（或 视图→缩略图），展开左栏缩略图列表 |
| G03 | annotate | read 态下点工具栏 `A 批注`，进入批注态（二级批注工具条出现） |
| G04 | edit grid | read 态下点工具栏 `T 编辑`，进入页面网格编辑态 |

若某状态在 3.9.2 实机上入口与上述不符，停止并在 manifest/coverage-gap 登记，不强行凑状态。

2026-07-24 补采校准：`G02` 入口实际得到的是“页面管理”全宽卡片网格（5 页同排），不是左栏缩略图列表；`G05` 记录了 `T 编辑` 的文本/图像/链接/隐藏编辑画布。左栏缩略图与文本选区浮条仍标记 missing。

## 命名规范

- 复采原图：`captures/raw/G<NN>-<state>-<run>.png`（run=a/b，未 crop、含桌面，仅作过程留痕）
- 窗口 crop 图：`captures/cropped/G<NN>-<state>-<run>.png`
- 准入 golden：`golden/G<NN>-<state>.png`（取 run=a 的 crop 为代表，附 sidecar `.meta.json`）
- 量测：`measurements.json`（结构见下）
- 状态规格：`state-specs/G<NN>-<state>.md`

## 量测方法

zai bbox MCP 当前未配置，M1 采用**人工量测**并强制记录 uncertainty（manifest README 与 golden 准入规则已允许此路径）：

- 工具：ImageMagick 生成 window-only crop，Preview/像素尺读取 crop 图像素坐标，按 Retina 2× 还原为逻辑 pt。
- 每个 key surface 记录：`{x, y, w, h}`（逻辑 pt，相对窗口左上原点）、`font_size_pt`、`gap_pt`、`method`、`uncertainty_pt`（本批次人工量测采用 ±4pt）。
- 不确定状态（如 R12 shape 语义）单独标 `confidence: low`，不推导精确值。

## measurements.json 结构

```json
{
  "meta": {
    "capture_protocol_version": 1,
    "app": "PDF Expert 3.9.2",
    "fixture": "tests/fixtures/expert/reference.pdf",
    "window": { "x": 200, "y": 120, "w": 1280, "h": 832 },
    "theme": "dark",
    "retina_scale": 2,
    "measurement_method": "manual pixel-read + /2 to logical pt",
    "default_uncertainty_pt": 4,
    "audit_date": "2026-07-24"
  },
  "captures": {
    "G01-read-default": {
      "run_a": { "path": "captures/cropped/G01-read-default-a.png", "px_w": 2560, "px_h": 1664 },
      "run_b": { "path": "captures/cropped/G01-read-default-b.png" },
      "stability_diff": { "tool": "...", "threshold": "...", "similarity": "...", "passed": true },
      "surfaces": [
        { "name": "L3 toolbar", "x": 0, "y": 0, "w": 1280, "h": 52, "confidence": "high", "notes": "..." }
      ]
    }
  }
}
```

## 稳定性 diff 判据

- 同状态两次 crop 的感知相似度 ≥ 阈值 → 准入 golden。
- 低于阈值 → 不准入；登记原因（动画未稳定/状态未复现/外部干扰）并重采或标 missing。
- 工具与阈值随首次实测记录进 `measurements.json` 的 `stability_diff` 字段，不事后修改。
