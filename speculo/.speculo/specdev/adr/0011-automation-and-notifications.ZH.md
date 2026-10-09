[English](0011-automation-and-notifications.md) | 简体中文

# ADR-0011：设备所属的自动化运行与独立的通知回执

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

同一个库可能在多台设备上打开，Obsidian 也随时可能关闭。自动化会执行带有外部影响的动作：启动 Agent 和脚本、打开页面、发送通知。这类影响不能因为定时器触发了两次、设备重启、库被同步或收件箱被清理而重复发生。

## 决定

**定义是 Markdown。** 独立定义是 `NAND/自动化/` 下带稳定编号的 Markdown 文档。归属于某个产品的定义留在该产品的文档里：看板待办和小组件（`home`）、档案提醒（`archives`）。这些模块向 `automations.sources` 贡献 `AutomationSource`，由它列出、保存和打开它们的定义。动作种类有 `script`、`agent`、`obsidian-command`、`open-file`、`open-url`、`notify` 和 `create-task`。计划有 `manual`、`once` 和 `recurring` 三种；重复计划可以带时区，定义还有处理晚启动的宽限时间。

**定义属于某台设备。** 每个定义有一个取自本机的执行设备编号。复制或同步库不会转移它。运行状态按设备分开：`.nand/automation/<device-id>/runtime.json` 保存调度游标和运行记录。

**先持久化意图。** 运行在动作开始之前先以 `pending` 写下。重启后，仍处于 pending 或 running 的运行会变为 `interrupted`，NAND 不会重放它。晚于宽限时间的定时运行会被跳过。手动定义从不进入定时队列。状态转换串行执行，持久化之后才发布给界面。状态有 `pending`、`running`、`unknown`、`succeeded`、`failed`、`cancelled`、`interrupted` 和 `skipped`。

**来源由事件索引。** 调度读取一份随库事件变化的内存索引，不会按计时器重新读取整个库。计时器和库监听器属于模块的生命周期，因此关闭模块会停止它们，并停止或中断自己拥有的运行。

**运行时端口是独立的。** Agent 和脚本动作通过 `agent.automation-runtime` 运行，该服务由桌面端的 agent 模块提供。没有它时，这些动作会报告不可用。

**通知把回执分开保存。** 收件箱分别保存可见消息和以请求编号为键的投递回执。编号已有回执的请求会被忽略，所以隐藏或裁剪消息不会造成第二次投递。插件停止时仍处于 `pending` 的投递，加载时变为 `unknown`，且不会自动重试。渠道有 `in-app` 和 `system`；系统渠道取决于操作系统的权限。通知失败不会改变它所报告的运行的原生结果。停止时，服务先拒绝新请求，再完成它已接受的持久化。收件箱按设备保存：`.nand/notifications/<device-id>/inbox.json`。

**打开器由贡献点提供。** 发送某类通知的模块向 `notifications.openers` 贡献打开器。automations 模块贡献打开运行记录或其来源的打开器。

## 影响

NAND 对外部影响提供至多一次的处理，而不是恰好一次：被关闭的宿主打断的运行会被报告，而不会被重复执行。Obsidian 关闭期间不会运行任何东西。

## 依据

[自动化服务](../../../../src/modules/automations/core/service.ts)、[定义](../../../../src/modules/automations/core/documents.ts)、[运行时](../../../../src/modules/automations/services/runtime.ts)、[自动化 api](../../../../src/modules/automations/api.ts)、[通知服务](../../../../src/modules/notifications/core/service.ts)、[通知 api](../../../../src/modules/notifications/api.ts)。自动化与通知测试（`pnpm test`）以及 `pnpm run test:safety-regressions`。
