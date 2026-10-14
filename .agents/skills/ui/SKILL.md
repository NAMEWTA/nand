---
name: ui
description: >-
  添加、修改或审查本仓库工作台页面、面板、对话框、组件、主题或 CSS 时使用。
  负责布局、设计系统、动效与无障碍；模块装配和构建参照 dev。
  普通产品问答、界面使用说明和仅提到页面或主题的讨论不触发实现与验收流程。
license: MIT
metadata:
  short-description: 工作台界面、设计系统与主题
---

# 工作台界面

本技能只适用于本仓库。`dev` 技能负责分区、模块装配、设置存储、文案和构建；本技能负责界面在屏幕上的样子和行为。

## 按任务读取

仅读取当前改动触及的参考和章节；不递归展开全部链接。下文流程用于界面实现，只读审查只核对适用约束。

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
4. CSS 改动放在所属方的 `styles/` 文件里并限定作用域；按 [验证选择表](../dev/references/testing.md) 重建、检查和验收。
5. 局部视觉改动检查受影响的页面、状态与尺寸并截图；主题、全局布局或宿主边界变化按验证选择表扩展矩阵或使用真实 Obsidian。

## 检查清单

- [ ] 在 shell 的页面／侧栏槽位里；没有新叶子、路由或标签栏
- [ ] 关闭时卸载；使用元素所在的窗口
- [ ] 只用原语和令牌；没有字面量颜色、`!important`、`:has` 或原始 z-index
- [ ] 键盘可达、有名称、焦点可见；遵守减少动效
- [ ] 与改动风险相符的视觉、行为和无障碍检查通过
- [ ] 验证选择表要求的检查通过，受影响产物已更新

清单只适用于本次触及的行为；原语未变的局部调整不重验整个工作台。
