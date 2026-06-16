/**
 * ISS-067 阶段 1：矩形遮罩模块入口（barrel）。
 *
 * 后续 ISS-067 阶段 2 接 AppShell + commands.ts 入口时通过本文件 import。
 */

export { applyRedaction, type RedactionRegion } from "./redactionEngine";
