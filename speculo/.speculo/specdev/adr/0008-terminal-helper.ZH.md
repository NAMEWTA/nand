[English](0008-terminal-helper.md) | 简体中文

# ADR-0008：终端辅助进程与 stdio 帧协议

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

终端需要原生伪终端（Windows 上是 ConPTY），但 Obsidian 渲染进程无法持有伪终端。本地端口上的网络服务会带来端口冲突、鉴权和重连状态。辅助进程还必须能以 MIT 许可证分发。

## 决定

- **一个辅助进程。** `nand-pty`（`native/pty-server`，Rust，基于 `portable-pty`）在每次插件加载中最多启动一次。插件只通过它的标准输入和标准输出与它通信。它不打开端口，也不需要令牌。
- **帧。** 帧由 4 字节大端长度、1 字节类型（控制、会话输入、会话输出）和正文组成。控制正文是 UTF-8 JSON（`hello`、`spawn`、`resize`、`ack`、`end`、`history`）。会话帧以 4 字节会话编号开头。帧正文最大 16 MiB。握手 `hello` 携带协议版本（3）；辅助进程不接受时，会以明确的错误失败。
- **生命周期。** 标准输入关闭时，辅助进程结束所有会话并退出。在 Windows 上，它加入一个作业对象，退出时作业对象终止其子进程。在类 Unix 系统上，结束会话时先挂断进程组，等待 2 秒，再强制终止。
- **每个会话一个权威模型。** 输出先进入插件中的 headless xterm 模型，模型解析后确认字节数。某个会话未确认的数据超过 1 MiB 时，辅助进程暂停读取，低于 256 KiB 时恢复。设备查询（DA、CPR、DSR、DECRQM、颜色、尺寸、kitty 标志）只由模型应答；可见视图吞掉这些查询，因此隐藏会话和自动化会话不会卡住，应答也不会重复。
- **视图可随时丢弃。** 可见视图先重放模型的序列化快照，再跟随实时输出。关闭页面或叶子只释放视图，会话继续运行。关闭模块或卸载插件会结束所有会话。
- **历史在同一个进程中。** 原生历史的扫描、查询、读取和取消，都是发给同一个辅助进程的请求（`history`），同一时间只有一次扫描在写索引。见 [ADR-0009](0009-agent-sessions-and-history.ZH.md)。
- **分发。** 辅助进程只由 CI 构建，目标为 linux-x64、linux-arm64、darwin-x64、darwin-arm64 和 win32-x64，并作为 Release 附件 `nand-pty-<platform>-<arch>[.exe]` 与 `.sha256` 文件发布。首次使用时，插件把与自身版本相同的 Release 中的附件下载到 `<插件目录>/binaries/`，校验 SHA-256 后运行。离线模式只使用已经安装的辅助进程。`NAND_PTY_BINARY` 让开发运行使用本地构建。仓库中不提交任何二进制。
- **来源。** 辅助进程和终端代码是为 NAND 编写的，以 MIT 许可证发布。它们依据公开的规范和文档构建：xterm 控制序列、kitty 键盘协议、win32-input-mode、ConPTY、OSC 7 与 shell 集成序列，以及 xterm.js 和 `portable-pty` 的文档。Orca（MIT）在 `NOTICE` 中署名。见 [ADR-0013](0013-license-and-attribution.ZH.md)。

## 影响

一个进程承载所有会话，所以辅助进程崩溃会让它们全部断开。插件显示原因，并在下次需要终端时重启辅助进程。作为交换，没有端口、令牌和重连状态。

## 依据

[帧](../../../../native/pty-server/src/frame.rs)、[辅助进程入口](../../../../native/pty-server/src/main.rs)、[会话](../../../../native/pty-server/src/session.rs)、[会话模型](../../../../src/modules/agent/services/terminal/session.ts)、[会话管理](../../../../src/modules/agent/services/terminal/sessions.ts)、[二进制安装](../../../../src/modules/agent/platform/desktop/pty/binary.ts)。`cargo test --locked`（帧、会话、流控、挂断、stdio 端到端）；针对会话模型和真实辅助进程的 Vitest 用例；CI 在五个目标上运行 `scripts/verify-pty-helper.mjs`；真实 Obsidian 探针中的终端页面。
