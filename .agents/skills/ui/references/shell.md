# 工作台 shell

代码：`src/app/workbench/workbench-leaf.ts`（注册的视图；打开时加载 shell）、`src/shell/host/workbench-surface.tsx`（状态、导航、渲染）、`src/shell/host/workbench-pages.ts`（页面生命周期）、`src/shell/Shell.tsx`、`Rail.tsx`、`SidePanel.tsx`、`PageHeader.tsx`、`layout.ts`、`navigation-state.ts`、`navigation-transition.ts`。图标轨条目在 `src/app/workbench/compose-workbench.ts` 里声明。

## 布局

```
┌────┬────────────────┬──────────────────────────────────────────┐
│ ①  │ ② 侧栏         │ ③ 页头 44px：⟨侧栏⟩ 标题 · 状态 · ⋯        │
│图标│ 标题 + 主操作   │ 标签条（仅资源页面）                       │
│轨  │ 搜索           │ 页面内容                                  │
│52px│ 分区／行        │                                           │
│ 🔔 │ （220–360px，   │                                           │
│ ⚙  │  默认 260）     │                                           │
└────┴────────────────┴──────────────────────────────────────────┘
```

| 叶子宽度 | 布局 |
|---|---|
| ≥ 960px（`wide`） | 三栏；侧栏内联显示 |
| 600–960px（`medium`） | 图标轨保留；侧栏作为覆盖层打开（有遮罩，Esc 关闭，焦点进入并在关闭后返回） |
| < 600px 或手机（`narrow`） | 图标轨和侧栏合成一个抽屉，从页头打开 |

布局跟随叶子自己的宽度（容器测量），而不是窗口宽度。桌面端隐藏原生视图头部，由页头代替；页头的 `⋯` 菜单调用页面的 `onPaneMenu`，并添加「在原生标签页中打开」「在分屏中打开」，资源页面还有「关闭当前页面」。

## 图标轨与侧栏行为

- 点击当前模块的图标切换侧栏。点击另一个图标回到该模块在这个叶子里的上次路由（`lastTargets`），侧栏保持原来的开或关。
- 上部：首页、智能体（桌面）、浏览器、档案、自动化、Git 同步（桌面）、图标、评论。浏览器任务的本地文档可在移动端阅读，网页控制仅桌面可用。下部：通知（带未读徽标）、设置。关闭的模块从图标轨消失；失败的模块显示警告标记。
- 记录页面（习惯、记账、番茄钟、阅读）属于首页（`railParent: 'dashboard'`），所以首页图标保持高亮。
- 侧栏宽度：拖动只改变 CSS 变量 `--nand-panel-width`；松开指针时提交该值并随叶子保存。双击重置为 260px；分隔条也响应方向键、Home 和 End。
- 面板模型（`src/app/contracts/workbench.ts` 里的 `PanelModel`）：可选的主操作、可选的行标签搜索，以及由行组成的分区（`label`、`icon`、`meta`、`badge`、`target` 或 `select`、`menu`、`active`）。悬停时行显示 `⋯`；右键打开同一个菜单。分区有 `emptyText`。模块也可以改为把自定义面板渲染到 `navigationEl`（智能体会话、档案筛选）。

## 页面

页面由贡献的 `create(context, target, state, signal)` 创建，并返回一个绑定：

| 成员 | 含义 |
|---|---|
| `surface` | 渲染到 `context.contentEl` 的 `NativeSurface`（`src/ui/native-surface.ts`） |
| `navigate(target, signal)` | 不重建页面就切换分区或资源；不得启动会话或其他副作用 |
| `getTarget()` | 实际显示的路由（用于页头标题和恢复） |
| `getState()` / `restore(state)` | 保存在叶子里的有界状态；只有 `stateKeys` 里的键会保留（`cleanPageState`） |

规则：

- 创建可以中止：遵守 `signal` 并快速返回；重活在首次绘制之后继续。
- 页面隐藏时保留（`hidden` + `inert`，`setVisible(false)`）；重新显示时调用 `setVisible(true)` 并触发一次 resize。带 `releaseWhenHidden` 的贡献（收件箱）离开时关闭。资源页面（`resourcePages: true`，浏览器标签、智能体会话）保留到被关闭。
- 未知分区回退到模块的默认页面；已停用的模块显示「开启模块」状态而不是重定向；缺失的资源显示可恢复的消息。
- `context.changed()` 告诉 shell 页面的路由或标题变了（页头、侧栏高亮、叶子状态）。
- 页头状态：`WorkbenchStatus` 行由模块服务经 compose-workbench 提供；只有 Obsidian 状态栏不存在（移动端）时页头才显示它们。

## 专注模式、标签与恢复

- 「在原生标签页中打开」和「在分屏中打开」会创建另一个 `focus: true` 的工作台叶子，带着该页面的状态：没有图标轨和侧栏，另有「在工作台中打开」操作。浏览器页面复制时获得新的页面 id。
- 标签条（`TabStrip` 原语）出现在资源页面：选择、关闭、中键关闭、键盘方向键、Home、End 和 Delete，拖动排序，`+` 新建资源。贡献可用 `resourceTabs(target)` 限定自动分配网页 ID 和显示标签条的分区；浏览器的普通网页使用标签条，`multi-ai` 和 `assistant` 分区使用任务自己的资源 ID。资源页面的保留身份包含分区，任务入口不会生成网页 ID。新增固定分区也须加入 `src/shell/navigation-state.ts` 的路由允许列表。
- 叶子状态是 shell 状态 `{ target, focus, panelOpen, panelWidth, lastTargets }` 加上保留的页面及其有界状态，加载时规范化（`normalizeWorkbenchState`）。恢复一个资源已不存在的路由时，打开对应分区而不是失败。

AI 工作台的发送集合与网页可见集合由服务分别保存；答案采集期间仍能切换可见性。原生输入只激活绑定的目标页面，激活回调在每个异步步骤后重验 admission，避免暂停后重新夺焦点。多个 guest 同时可见时，仅宿主元素的焦点不足以证明输入路由：输入层通过位置校验后的原生点击聚焦编辑器，核对宿主和编辑器焦点，再填入和读回文本。

## 不要

- 不要在模块里加路由、历史栈或标签系统。
- 不要嵌套 `ItemView`，也不要为显示一个页面而打开新的叶子类型。
- 不要仅仅因为渲染了页面或面板就启动终端、网页或网络请求；等待明确的操作。
