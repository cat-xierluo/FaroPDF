import type { SectionProps } from "./types";

interface ShortcutRow {
  keys: string;
  description: string;
  group: "阅读翻页" | "缩放与旋转" | "工具切换";
}

const SHORTCUT_ROWS: ReadonlyArray<ShortcutRow> = [
  { group: "阅读翻页", keys: "PageDown / Space / ↓ / →", description: "下一页（双页模式步进 2 页）" },
  { group: "阅读翻页", keys: "PageUp / ↑ / ←", description: "上一页（双页模式步进 2 页）" },
  { group: "阅读翻页", keys: "Home", description: "跳到第一页" },
  { group: "阅读翻页", keys: "End", description: "跳到最后一页" },
  { group: "缩放与旋转", keys: "工具栏 · 顺时针 / 逆时针", description: "旋转当前文档 90°" },
  { group: "缩放与旋转", keys: "工具栏 · 缩放预设", description: "8 档缩放 + 适合宽度 / 适合页面" },
  { group: "工具切换", keys: "工具栏 · 模式按钮", description: "阅读 / 批注 / 导出 / 填写 / OCR / 页面" },
  { group: "工具切换", keys: "工具栏 · 视图 / 摘要 / 设置", description: "右侧 utility 面板切换" },
];

function groupByGroup(rows: ReadonlyArray<ShortcutRow>): ReadonlyArray<{
  group: ShortcutRow["group"];
  rows: ReadonlyArray<ShortcutRow>;
}> {
  const order: ShortcutRow["group"][] = ["阅读翻页", "缩放与旋转", "工具切换"];
  return order.map((group) => ({ group, rows: rows.filter((row) => row.group === group) }));
}

/**
 * 「快捷键」section（只读）。当前仅展示内置快捷键，不暴露编辑入口；
 * 可编辑快捷键配置将留待后续 ISS。
 */
export function ShortcutSection(_props: SectionProps) {
  // 仅展示用，onChange 形参被有意忽略。
  void _props;
  const grouped = groupByGroup(SHORTCUT_ROWS);

  return (
    <section className="settings-section" aria-label="快捷键">
      <h2 className="settings-section__title">快捷键</h2>
      <p className="settings-section__hint">当前为只读参考；自定义快捷键将在后续版本提供。</p>

      {grouped.map((entry) => (
        <section className="settings-shortcut-group" key={entry.group}>
          <h3>{entry.group}</h3>
          <dl className="settings-shortcut-list">
            {entry.rows.map((row) => (
              <div className="settings-shortcut-row" key={row.keys}>
                <dt>
                  <kbd>{row.keys}</kbd>
                </dt>
                <dd>{row.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  );
}
