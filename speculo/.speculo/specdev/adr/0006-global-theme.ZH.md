[English](0006-global-theme.md) | 简体中文

# ADR-0006：全局主题

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

NAND 的界面和用户的 Markdown 笔记应该看起来是同一个产品，NAND 的颜色也应该跟随 Obsidian 的明暗主题。各个功能里的私有调色板会与 Obsidian 主题冲突，也无法改变笔记的外观。

## 决定

- **body 类与变量。** 主题以 `body` 上的类应用，覆盖 Obsidian 自己的变量（背景、文字、强调色、标题、加粗、链接、引用、代码），编辑器、阅读视图和 NAND 界面同时变化，而不必与选择器对抗。类有 `nand-theme--<预置>`、`nand-md-headings--<样式>`、`nand-md-emphasis--<样式>`，以及 `nand-theme-accent-light`、`nand-theme-accent-dark`、`nand-theme-line-height`，对应变量 `--nand-user-accent-light`、`--nand-user-accent-dark`、`--nand-user-line-height`。
- **预置。** `system`（默认，不设置任何覆盖）、`claude-code` 和 `eye-care`，各有明、暗两种变体。外观页可调整标题样式（`preset`、`accented`、`plain`）、强调样式（`preset`、`accent`、`highlight`、`plain`）、明暗两种强调色（`#rrggbb`，留空则使用预置的颜色）和阅读行高（0 表示使用预置的值）。该页还能导入和导出这些选择。
- **所有窗口共用一个运行时。** `ThemeRuntime` 把状态应用到主窗口和每个弹出窗口，`theme` 命名空间变化时重新应用，卸载时移除所有类和变量。
- **没有私有调色板。** NAND 界面使用由 Obsidian 变量派生的令牌（`src/ui/styles/000-foundation.css`）。功能不定义自己的调色板。

## 影响

选择 `system` 之外的预置时，可能与社区主题叠加；外观页会提示这一点。默认设置不触碰 Obsidian。

## 依据

[主题设置](../../../../src/theme/settings.ts)、[运行时](../../../../src/theme/runtime.ts)、[预置样式](../../../../src/theme/styles/presets.css)、[基础令牌](../../../../src/ui/styles/000-foundation.css)。预置与设置测试（`src/theme/presets.test.ts`、`src/theme/settings.test.ts`），以及截图矩阵 `scripts/obsidian-acceptance/theme-matrix.mjs`。
