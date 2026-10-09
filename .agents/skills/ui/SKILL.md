---
name: ui
description: >-
  How NAND draws its interface: the three-column workbench (icon rail, side
  panel, page), workbench pages and panels, dialogs, the design system
  (tokens, primitives, patterns), the global theme and Markdown styles, and
  motion and accessibility rules. Use when adding or changing a page, panel,
  settings page, dialog, component or CSS in this repository, or when the
  user mentions 工作台, 三栏, 图标轨, 侧栏, 页面, 界面, 样式, 主题, 外观, 动画,
  组件, Preact, workbench, rail, panel, theme or design system. Module
  wiring, settings storage and builds are the dev skill.
license: MIT
metadata:
  short-description: Workbench UI, design system and theme
---

# 工作台界面

本技能只适用于本仓库。`dev` 技能负责分区、模块装配、设置存储、文案和构建；本技能负责界面在屏幕上的样子和行为。

## 修改前先读

| 要做的事 | 打开 |
|---|---|
| 添加页面，或修改图标轨、侧栏、页头、标签或专注模式 | [references/shell.md](references/shell.md) |
| 选择颜色、间距、圆角、组件或 CSS 做法 | [references/design-system.md](references/design-system.md) |
| 涉及主题样式、Markdown 样式或 设置 → 外观 | [references/theme.md](references/theme.md) |
| 做任何动画，或处理键盘、焦点、读屏 | [references/motion-a11y.md](references/motion-a11y.md) |
| 调用 Obsidian 的 DOM API 或编写 CSS | [../dev/references/obsidian-api.md](../dev/references/obsidian-api.md) |

## 整体形态

NAND 只注册一个工作台视图。它的叶子显示 ① 52px 的图标轨、② 当前模块的侧栏（列表、分区、搜索、主操作）和 ③ 带页头的页面。模块贡献页面；shell（`src/shell/`）负责布局、导航、侧栏状态、页面生命周期和动效。模块不自己建叶子、路由或标签系统。

| 需要 | 使用 |
|---|---|
| 用户导航到的一个界面 | 工作台页面（`PageCreate` → `NativeSurface`） |
| 第 ② 栏里供选择的一组对象 | 贡献的 `panel` 模型（`PanelModel`），由模块服务提供数据 |
| 设置 | 模块的 `settingsPage` 渲染函数，使用原生 `Setting` 行 |
| 简短的决定或一个输入（确认、重命名、选择） | `openDialog` / `promptText`（`src/ui/primitives/`），或 Obsidian 的 `SuggestModal` |
| 操作菜单 | `showMenu`（Obsidian 的 `Menu`） |
| 临时消息 | `Notice` |
| 编辑记录、规则、长表单 | 在页面里就地编辑，不用对话框 |

## 规则

1. 业务内容用 Preact 渲染到宿主给你的元素里（表面的 `contentEl`、侧栏的自定义槽位），关闭时用 `render(null, root)` 卸载。原生外壳（设置行、菜单、通知、状态栏）用 Obsidian API。
2. 页面从所属模块读取状态并发出动作；不拥有持久数据。临时的界面状态（重命名输入框、打开的菜单）可以放在组件里；需要在窗口移动或重启后保留的内容，放进 `getState()`，键列在贡献的 `stateKeys` 里。
3. 从元素取得窗口（`el.win`、`el.doc`）；绝不在模块顶层捕获 `window` 或 `document`。弹出窗口有自己的 document。
4. 用 `references/design-system.md` 里的原语和令牌构建。不要有第二套设计系统，不用 CSS-in-JS，不用允许列表之外的界面库。
5. 颜色来自派生自 Obsidian 变量的令牌，所以社区主题和 NAND 样式都能用。字面量颜色只存在于 `src/theme/` 和令牌层。不用 `!important`，不用 `:has`，z-index 只通过令牌。
6. 每个可交互元素都是真正的按钮或输入框，有可访问名称，可通过键盘到达，并在 `:focus-visible` 时可见。目标至少 32px（触屏 44px）。
7. 动效只用 `transform` 和 `opacity`、时长令牌和 `--nand-ease`，并在 `prefers-reduced-motion` 下关闭。
8. 文字节点是测试的一部分：改样式时保持措辞和结构稳定。

## 流程

1. 按上面的表格决定放在哪里。如果是页面，按 `references/shell.md` 和 `../dev/references/module-authoring.md` 里的页面步骤做。
2. 文件放进模块的 `ui/` 文件夹：组件用 PascalCase（`InboxPanel.tsx`），逻辑和加载器用 kebab-case（`workbench-page.ts`）。
3. 组合原语；在它们旁边加模块自己的类名来做布局。两个模块都需要的通用原语放进 `src/ui/`。
4. 在模块的 `styles/` 文件里写 CSS，限定在它的类名下；重建 `styles.css`（`node scripts/build-styles.mjs --write`）并运行 `pnpm run lint:css`。
5. 检查浅色与深色、三种主题样式，以及三种宽度（≥960、600–960、<600／手机）。真实 Obsidian 探针覆盖多种宽度下的工作台；视觉改动要截图。

## 检查清单

- [ ] 在 shell 的页面／侧栏槽位里；没有新叶子、路由或标签栏
- [ ] 关闭时卸载；使用元素所在的窗口
- [ ] 只用原语和令牌；没有字面量颜色、`!important`、`:has` 或原始 z-index
- [ ] 键盘可达、有名称、焦点可见；遵守减少动效
- [ ] 在浅色／深色、所有主题样式和三种宽度下都正常
- [ ] `pnpm run build`、`pnpm run lint` 和 `pnpm run lint:css` 通过
