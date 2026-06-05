/**
 * forms 模块断点常量
 *
 * 集中管理 FormsPanel 等模块内 UI 组件使用的视口断点，避免在组件 / CSS / 测试
 * 各自硬编码魔法数字导致后续维护分散。
 *
 * 设计原则：
 * - 单一来源：FormsPanel CSS 与 React 组件的 media query 都引用本常量；
 * - 与全局 app.css 收口策略对齐（AuthorCard / SettingsPanel 选用 480 / 768 等数值，
 *   forms 模块以 480 为窄屏分界，与 AuthorCard 一致，避免在 AppShell 尚未统一
 *   收口断点前再制造新数值）。
 * - 不引入新依赖；不修改 package.json / 锁文件。
 */

/** FormsPanel 浮层切换为底部抽屉（bottom sheet）的视口宽度上限。 */
export const FORMS_PANEL_NARROW_BREAKPOINT = 480;

/** FormsPanel 从 utility panel 切换为 drawer 浮层的视口宽度上限。 */
export const FORMS_PANEL_DRAWER_BREAKPOINT = 720;

/**
 * 构造传给 `window.matchMedia` 的 media query 表达式。
 * 形如 `(max-width: 479px)`：与 CSS `@media (max-width: 479px)` 保持一致。
 */
export function formsPanelNarrowMediaQuery(): string {
  return `(max-width: ${FORMS_PANEL_NARROW_BREAKPOINT - 1}px)`;
}

/**
 * 构造 drawer 断点 media query：`(max-width: 719px)`。
 * 视口 < 720px 时 FormsPanel 不走 utility panel，改用 drawer / bottom-sheet。
 */
export function formsPanelDrawerMediaQuery(): string {
  return `(max-width: ${FORMS_PANEL_DRAWER_BREAKPOINT - 1}px)`;
}
