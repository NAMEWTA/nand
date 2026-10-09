[English](0009-agent-sessions-and-history.md) | 简体中文

# ADR-0009：Agent 会话与限定在当前库的原生历史

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

编程智能体 CLI 有自己的日志、身份和恢复协议。NAND 在终端中启动它们，显示它们的历史，并让其他功能向它们传递材料。这样做不能把用户的全局 CLI 历史混进某一个库，不能改动 CLI 的状态，也不能发送用户没有确认的文本。

## 决定

- **会话由会话管理器拥有。** 会话（一个 shell、一个编程智能体或一个预设）及其权威缓冲属于 agent 模块，不属于叶子或页面。导航到某个会话、历史或用量，从不创建会话，也不启动进程。只有显式的操作才会启动。
- **目录驱动启动。** `src/modules/agent/core/launch/catalog.ts` 为每个 CLI 设一条记录：Claude Code、Codex、Gemini CLI、OpenCode、Pi 和 Grok，包含检测与启动命令、安装与升级命令、绕过权限的参数、账号类型、用量读取器、CLI 是否接受上下文，以及自动化如何把提示词交给它。点击会打开终端并发送该命令。
- **历史只读，且限定在当前库。** 辅助进程扫描各 CLI 自己的日志根目录，只保留工作目录是当前库或在其内部的会话。NAND 从不写入 CLI 的日志。NAND 自己增加的内容单独保存：标题和标注在 `.nand/terminal-agent/<device-id>/`，那里还有一个随时可以重建的 SQLite 索引。恢复使用准确的原生会话编号，该会话不存在时报告错误。凭据和账号日志不会被复制进库。
- **导出从不覆盖。** 导出会话会把 Markdown 写入 `NAND Exports/`；名称已存在时加数字后缀。
- **用量是读取的，不是计算的。** 用量来自原生日志和提供方状态。缺失的值显示为未知。
- **材料是粘贴，不是发送。** 其他模块通过 `agent.sessions` 服务到达会话：`list` 和 `attachMaterial`。附加会把一段文本和文件粘贴进会话的输入但不提交，并且在用户附加之前先显示目标会话。输入尚未就绪时，附加会等待有限的时间，然后明显地失败。
- **自动化使用单独的运行时端口。** `agent.automation-runtime` 为 automations 模块启动 Agent 与脚本运行。它的会话记录在 `.nand/terminal-agent/<device-id>/automation-sessions.json`。
- **未知就是未知。** 没有可靠的原生事件或数据时，NAND 显示未知状态，不推断成功。

## 影响

库的历史视图只显示属于这个库的内容。CLI 升级若改变日志格式，可能使扫描失效；此时扫描会明显地失败，索引会被重建。

## 依据

[Agent api](../../../../src/modules/agent/api.ts)、[目录](../../../../src/modules/agent/core/launch/catalog.ts)、[历史服务](../../../../src/modules/agent/platform/history/service.ts)、[历史扫描](../../../../src/modules/agent/platform/desktop/history/scan.ts)、[辅助进程的历史请求](../../../../native/pty-server/src/agent_data.rs)。`src/modules/agent/` 下的历史、扫描和会话测试，以及 `cargo test --locked`。
