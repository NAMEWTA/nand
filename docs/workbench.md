# 工作台

功能区只有一个 NAND 图标，命令 ID 是 `open-workbench`，名称是「打开工作台」。看板、档案、自动化、浏览器和终端都从这里进入，不再各放一个功能区图标。设置里的 **设置 → NAND → 首页** 仍是插件设置，产品 ID 是 `home`。工作台里的「首页」是看板，功能 ID 是 `dashboard`。

## 页面

| 页面 | 功能 ID | 仍注册的原生视图类型 |
|---|---|---|
| 工作台外壳 | — | `nand-workbench-view` |
| 首页（看板） | `dashboard` | `nand-dashboard-view` |
| 档案 | `contacts` | `nand-contacts-view` |
| 自动化 | `automations` | `nand-automation-view` |
| 浏览器 | `browser` | `nand-browser-view` |
| 终端 / Agent | `terminal` | `terminal-view` |
| 通知 | `notifications` | — |
| 编辑器 | — | `nand-editor-view` |

原生视图类型继续注册，供已有标签和恢复使用。工作台页面画在工作台叶子里，不把另一整个原生视图嵌进去。

首页在工作台里使用堆叠布局来排这一页，不会把「堆叠」写回看板自己的 `layoutMode`。习惯和记账仍是首页上的小组件，不是独立的工作台页面。

## 分屏与终端

分屏会复制当前页面状态并使用新的页面 ID。终端会话活不过 Obsidian 重启：重启后不会自动新建 PTY，也不会重放上一次的命令。已经不存在的终端 ID 会打开终端分区，而不是整页失败。档案、看板和浏览器里指向不存在的资料仍然会失败。

嵌入的 Agent 页打开时不另行初始化一条终端。普通 Shell 显示已连接时，只表示会话连上了，不是智能体正在执行。

更多说明见 [Agent 工作台](agent-workbench.md)、[看板][dashboard] 和 [隐私](privacy.md#记录什么)。

[dashboard]: dashboard.md
