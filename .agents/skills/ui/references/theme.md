# 全局主题

代码：`src/theme/settings.ts`（`theme` 设置命名空间、主题样式、解析为 body 类名和变量）、`src/theme/runtime.ts`（把它们应用到主窗口和每个弹出窗口，卸载时移除）、`src/theme/styles/presets.css`、`src/theme/styles/markdown.css`、`src/app/settings/appearance.ts`（设置 → 外观）、测试 `src/theme/*.test.ts`。

## 工作方式

主题覆盖 `body` 上 Obsidian 自己的**变量**，从不覆盖 Obsidian 的选择器。每个选项对应一个类名：

| 类名 | 来源 |
|---|---|
| `nand-theme--<preset>` | 主题样式（`claude-code`、`eye-care`；`system` 没有） |
| `nand-md-headings--accented` | 标题样式（样式默认或用户选择） |
| `nand-md-emphasis--accent` / `--highlight` | 加粗样式 |
| `nand-theme-accent-light` / `-dark` + `--nand-user-accent-light/-dark` | 每种明暗模式的自定义强调色 |
| `nand-theme-line-height` + `--nand-user-line-height` | 自定义阅读行高 |

样式规则写成 `body.nand-theme--<id>.theme-light` 和 `.theme-dark`，设置 `--background-*`、`--text-*`、`--interactive-accent*`、`--h1…h6-*`、`--bold-*`、`--italic-color`、`--link-*`、`--blockquote-*`、`--code-*`、`--hr-*` 和字体。编辑器和阅读视图读取这些变量；NAND 界面在默认「跟随 Obsidian」配色时由组件令牌映射读取它们。Orca 中性配色按自己的局部令牌覆盖；看板的 `--db-*` 从这些令牌派生，没有自己的主题。没有变量可用的 Markdown 装饰（一级标题的分隔线、二级标题的竖条）是 `markdown.css` 里 `.markdown-rendered` 和 `.markdown-source-view .HyperMD-header-N` 下的几条规则。

## 主题样式

| Id | 外观 |
|---|---|
| `system`（默认） | 没有类名，没有覆盖：一切由 Obsidian 或社区主题决定 |
| `claude-code` | 象牙白／炭灰背景，陶土橙强调色，衬线标题；标题用强调样式，加粗用强调色 |
| `eye-care` | 浅绿／深绿灰背景，对比更柔和，行高更高；标题用强调样式，加粗用荧光笔样式 |

`src/theme/presets.test.ts` 检查每个样式在两种明暗模式下的对比度：正文 7:1，次要文字 4.5:1，淡色文字 3:1，链接和强调色文字 4.5:1，强调色上的文字 4.5:1。命令「切换主题样式」（`cycle-theme`）依次切换各个样式。

## 添加样式

1. 把 id 加入 `THEME_PRESETS`，把它的标题和加粗默认值加入 `PRESET_STYLES`（`src/theme/settings.ts`）。
2. 在 `presets.css` 里添加 `body.nand-theme--<id>.theme-light` 和 `.theme-dark` 块，只设置变量；全局主题的字面量颜色只放在这里。NAND 局部令牌的颜色位置见设计系统参考；看板不加主题。
3. 添加标签键 `appearance.preset.<id>`（启动词典 `src/shared/i18n/appearance.ts`，两种语言）。
4. 在 `presets.test.ts` 里加入新配色并运行 `pnpm test`。
5. 用 `scripts/obsidian-acceptance/theme-matrix.mjs` 截图（阅读、实时预览、源码；浅色和深色）。

## 外观设置

工作台设置 → 外观使用 React 设置组件；Obsidian 设置页只留打开工作台设置的入口按钮。全局外观选项包括：样式、标题样式、加粗样式、阅读行高、浅色／深色强调色（可重置），以及把整个外观复制／粘贴／重置为 JSON。值由模式规范化（`#rrggbb` 强调色，行高 0–2.2，0 表示保持样式的值）。

## NAND 局部外观

- `src/ui/styles/tokens.css` 在 `.nand-ui` 上派生组件令牌；配色默认跟随 Obsidian，可选 `body[data-nand-palette="orca"]` 中性配色（属性由 `src/app/appearance-runtime.ts` 在每个窗口的 body 上设置，卸载时移除）；它只改 NAND 令牌，不覆盖 Obsidian 本体，本体由 `theme.preset` 控制。
- 界面字体默认 Geist + 中文系统字体回退，可选「跟随 Obsidian」映射到 `--font-interface`；等宽使用 Geist Mono，终端字体单独设置。
- 看板根的 `--db-*` 全部从组件令牌派生（`home/ui/theme/tokens.css`），没有独立主题；看板弹窗在所属窗口 Portal 内带 `nand-dashboard-root`，圆角、模糊等装饰覆盖在弹窗里镜像，主题字体开关默认关闭。完整取值和位置见 [设计系统参考](design-system.md)。

## 共存

- 全局主题选择「跟随系统」时不覆盖宿主变量；NAND 自己的局部配色与字体仍由上述选项控制。
- 其他样式会覆盖主题的变量；外观页建议使用社区主题时保持「跟随系统」。
- 模块界面必须在每种样式下、在看板未挂载时也显示正常；`--db-*` 变量属于看板。
- body 类名和变量在卸载时于每个窗口中移除。
