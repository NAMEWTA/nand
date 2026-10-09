[English](0010-browser-sessions.md) | 简体中文

# ADR-0010：浏览器分区、权限与页面生命周期

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

浏览器模块在 Obsidian 内嵌入网页（Electron `webview` guest）。标签页、弹窗和登录窗口必须共用同一个登录会话，网页不能触及 Node 或库，一次永远没有响应的导航不能让关闭操作或 Agent 调用悬挂。Agent CLI 可以驱动浏览器，而这项能力在用户打开之前必须保持关闭。

## 决定

- **每个库一个分区。** 一个库的页面使用 Electron 分区 `persist:nand-browser-<库编号>`。弹窗和登录窗口使用相同的分区和相同的策略。Cookie 留在本机 Electron 会话里，不写入设置，也不写入库。
- **Guest 策略。** 只有满足以下条件的 guest 才被接受：类型是 `webview`、关闭 Node 集成、使用 NAND 浏览器分区。只加载允许的网址。脚本打开的窗口受到频率和数量限制：普通链接交给 NAND 作为页面打开，带明确窗口特性的请求则成为使用同一分区和策略的子窗口。
- **权限是按来源的决定。** 摄像头和麦克风、位置、通知、读取剪贴板和全屏，除非用户对该来源授予了该权限，否则一律拒绝；来自其他来源或子框架的请求不会继承顶层页面的授权。授权和最近的浏览历史保存在 `.nand/browser/<device-id>/state.json`。
- **页面身份与操作。** 页面有稳定的身份和快照版本。元素引用只在产生它的快照内有效，过期的引用会被拒绝。对页面的操作经过每个页面一个的队列。关闭页面会关闭队列：排队的工作被拒绝，正在运行的调用方立刻结束，晚到的原生结果被丢弃。
- **退役。** 替换正在进行的加载，或页面无法被安全停止时，guest 被退役：它被释放，需要时再创建新的，所以晚到的事件不会影响新页面。
- **Agent 桥需要主动开启。** 「允许智能体会话使用浏览器」设置关闭时，不会启动任何连接。打开后，模块提供本地连接和 CLI 来源；只有由 NAND 以 Agent 身份启动的会话才会得到连接变量（`NAND_BROWSER_CLI`、`NAND_BROWSER_CONTEXT`、`NAND_BROWSER_TOKEN`、`NAND_BROWSER_GUIDE`）。令牌只在连接运行期间有效，过期的连接文件会被清理。
- **材料经由会话。** 页面、选中的元素和截图，通过 `agent.sessions` 作为粘贴的材料到达 Agent（[ADR-0009](0009-agent-sessions-and-history.ZH.md)）；浏览器不拥有 Agent 进程。
- **打开页面。** 其他模块通过 `browser.open` 服务打开页面。浏览器页面是工作台的资源页面：可以复制到专注模式的叶子里，副本使用新的页面编号。

## 影响

网页内容与插件隔离，代价是受 Electron `webview` 的限制。浏览器只在桌面端工作；在移动端，工作台把它标为不受支持。

## 依据

[Guest 策略](../../../../src/modules/browser/platform/desktop/guest-policy.ts)、[操作队列](../../../../src/modules/browser/core/operation-queue.ts)、[页面](../../../../src/modules/browser/platform/desktop/page.ts)、[存储](../../../../src/modules/browser/platform/store.ts)、[模块](../../../../src/modules/browser/module.ts)。浏览器测试（`src/modules/browser/browser.test.ts`）和真实 Obsidian 探针中的浏览器 guest 检查。
