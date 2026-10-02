# ADR-0003：PTY 会话、鉴权与终端呈现分离

状态：已接受，当前规范。核对日期：2026-10-01。

## 问题

隐藏终端不能丢失输出或误杀进程；持续输出、阻塞输入和未经认证连接不能影响其他会话。

## 决策

TerminalService/PtySession 持有原生会话和 headless xterm 权威缓冲，叶子只获取可视渲染器。关闭叶子隐藏会话，停止会话或停用模块终止进程。Rust 协议 2 在 PTY 与历史路由前验证实例令牌、协议和期限；令牌经启动管道交付。阻塞输入使用会话级有界队列，输出在 headless 解析后按原始字节确认，高低水位为 256/64 KiB。

## 取舍与约束

保留 Windows Job Object 和真实退出码。旧二进制协议不兼容时明确失败，不回退到无认证。卸载先停止接收工作，再排空已有写入并回收资源。

## 验证依据

[当前源码](../../../../src/platform/desktop/terminal/pty-session.ts)。pnpm test:terminal-agent；Rust MSVC 单测与 Windows 原生 PTY 集成；其他平台按 CI 矩阵和实机分别验证。

本页描述当前工作区的有效决定，不反写历史实施时间。实际执行结果见[当前基线](../archive/2026-10/2026-10-01-current-baseline/README.md)。
