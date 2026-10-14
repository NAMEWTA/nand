# 工作台 shell

目标契约与版式见 [02 架构文档 §7](../../../../docs/refor/02-架构文档.md) 和 [04 工作台外壳与状态栏](../../../../docs/refor/04-设计-工作台外壳与状态栏.md)。图标轨贡献在 `src/app/workbench/compose-workbench.ts`；叶子在 `app/workbench/workbench-leaf.ts`，React 外壳由 `shell/host/workbench-surface.tsx` 挂载 `ShellRoot`。页面生命周期由 `shell/host/workbench-pages.ts` 管理。

## 布局

外壳由 52px 图标轨、可选侧栏、页面框和底部 24px 状态栏组成。侧栏宽 220～500px，默认 280px；`chrome: 'standard'` 有 44px 页头，`chrome: 'none'` 由页面自己画顶部。

| 叶子宽度 | 布局 |
|---|---|
| ≥960px（wide） | 图标轨 + 可选内联侧栏 + 页面 |
| 600～960px（medium，不含 960） | 图标轨保留；侧栏作为覆盖层，遮罩或 Esc 关闭，焦点进入并在关闭后返回 |
| <600px 或手机（narrow） | 图标轨和侧栏合成左侧 Sheet，由页面菜单按钮打开 |

档位由 `ResizeObserver` 测量叶子自身宽度，再调用 `shell/layout.ts` 的 `layoutFor()`。手机隐藏底部状态栏，页头或自绘顶部显示最多 3 个状态芯片。桌面视图隐藏 Obsidian 原生头部。

## 图标轨与侧栏

| 位置 | 功能 id | 名称 | 侧栏 |
|---|---|---|---|
| 上 | `dashboard` | 首页 | 无；看板自己的侧栏与横幅切换属于页面内部 |
| 上 | `terminal` | 智能体 | Orca 会话栏，由页面经 `navigationEl` 渲染；桌面端 |
| 上 | `contacts` | 档案 | 分组与筛选 |
| 上 | `automations` | 自动化 | 无，页面全宽 |
| 上 | `sync` | Git 同步 | 变更 / 历史；桌面端，默认关闭 |
| 上 | `icons` | 图标 | 分区 |
| 上 | `content` | 内容 | 受管文件列表与搜索 |
| 下 | `notifications` | 通知 | 未读 / 全部，轨道显示未读徽标 |
| 下 | `settings` | 设置 | 分类与搜索 |

浏览器没有独立入口和侧栏，由智能体工作区管理浏览器标签；批注在 Obsidian 右侧栏；记录通过看板统计弹窗打开。

- 点击当前功能切换侧栏，无侧栏功能无反应；点击其他图标回到该叶子的 `lastTargets`，保持侧栏开合偏好。
- 首页和设置始终显示；已关闭模块隐藏，失败模块显示警告标记和说明。右键菜单保留「在新标签页打开」「在分屏中打开」。
- 贡献不提供 `panel` 且不声明 `navigationContext` 时不显示第 2 栏，不从导航子项隐式生成侧栏。
- `PanelModel` 仍支持主操作、搜索、分区及行的 `label/icon/meta/badge/target/select/menu/active`。行的 `⋯` 与右键菜单内容相同。自定义侧栏用 React `createPortal` 挂到 `navigationEl`。
- 拖动侧栏仅更新尺寸，松开保存叶子状态；双击回到 280px，方向键每次 8px，Home/End 到 220/500。

## 页面契约

页面贡献 `create(context, target, state, signal)` 返回绑定：

| 成员 | 含义 |
|---|---|
| `surface` | `ReactSurface`（继承 `NativeSurface`），独立 React 根挂到 `context.contentEl` |
| `navigate(target, signal)` | 切换分区或资源，不因导航启动会话等动作 |
| `getTarget()` | 实际显示的目标 |
| `getState()` / `restore(state)` | 有界叶子状态，只有贡献 `stateKeys` 中的键保留 |

- `chrome?: 'standard' | 'none'` 默认 `standard`。首页、智能体工作区和自动化用 `none`。
- `standard` 页头显示标题、侧栏开关和页面菜单，专注模式增加「在工作台中打开」。`none` 页面必须自备可见身份、调用 `context.openPageMenu(event)` 的菜单入口，以及需要时调用 `context.togglePanel()` 的导航开关；无侧栏页面在窄布局仍保留打开图标轨抽屉的入口。
- 遵守中止信号；隐藏时 `hidden` + `inert` 并 `setVisible(false)`，保留 React 根、终端及网页实例；显示时恢复可见性并适配一次尺寸。`releaseWhenHidden` 仅用于声明需要离开即释放的页面。
- 关闭或模块停用时 `root.unmount()`，释放订阅和 Portal 引用。页面独立错误边界，不连带卸载 shell。
- `context.changed()` 通知路由、标题和叶子状态变化。未知分区回默认页；模块关闭、设备不支持、启动失败和资源缺失各有可恢复的 EmptyState。

## 状态栏

默认在所有 NAND 页面显示。左侧 `UsageCluster` 从 `agent/api.ts` 的 `AGENT_USAGE` 读取快照；右侧汇总贡献的 `statusSegments()`，按 `order` 排序。`StatusSegment` 包含 `id/icon/label/order`，可选 `tone/count/target`；文案已经翻译，点击可跳转目标。

- 左簇空间不足时先精简，再将提供方收进 `+N`，最后隐藏单位标签；右簇不裁剪，必要时横向滚动。
- 右簇依次显示等待输入、运行中智能体、运行中自动化、自动化错误、Git 同步、看板保存失败、未读通知；无对应状态时隐藏。
- 用量区点击向上打开面板，提供刷新、详细/精简、账号切换、用量详情与账号管理。额度阈值、折叠测量与时间刷新按 04 §5 实现。
- 空白处右键可隐藏各段、选择已用/剩余及详细/精简，或隐藏整条状态栏；常规设置可重新开启。
- Obsidian 原生状态栏的精简用量是默认关闭的独立选项；原有待处理事项状态栏由工作台状态栏取代。

## 专注模式、标签与恢复

- 新标签页或分屏打开的是同一种 `focus: true` 工作台叶子，不带图标轨和侧栏，并保留返回完整工作台的入口。
- 智能体工作区内部拥有 Orca 标签条与分屏：终端、智能体、浏览器共用标签组；「+」菜单新建，键盘选择/关闭，拖拽排序或到边缘分屏。这是模块内部工作区，不另建 shell 路由系统。
- 叶子状态保存 `target/focus/panelOpen/panelWidth/lastTargets` 及有界页面状态；工作区标签布局由服务持久化，位置见 [dev 架构参考](../../dev/references/architecture.md)。
- 重启恢复布局和浏览器标签；终端显示已结束占位，有原生会话 id 的智能体标签提供恢复按钮，用户点击后才新建 CLI 恢复进程。
- 原生叶子的可见性经 `WorkbenchView` → `WorkbenchSurface.setVisible()` 传给外壳和当前页面；分屏中仍显示的叶子不因失去活动焦点而隐藏。隐藏时卸载外壳的抽屉、菜单及 Tooltip，保留独立页面根，恢复显示不重开旧弹层。轨道打开原生标签/分屏前先结束当前交互；旧弹层延迟回焦不能抢走新叶子的焦点。
- 不嵌套 ItemView；不因普通渲染启动终端或动作。浏览器标签的恢复按保存布局执行，不能因此发送网页操作。

键盘与焦点（含 F6 在图标轨、侧栏、页面、状态栏循环）见 [动效与无障碍](motion-a11y.md)。
