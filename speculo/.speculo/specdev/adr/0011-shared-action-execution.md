# ADR-0011：公共动作与界面引用

状态：已接受，当前规范。核对日期：2026-10-01。

## 问题

看板快捷项、手动操作和定时执行需要共用参数验证、能力判断与运行状态。

## 决策

ActionDescriptor 声明能力；ActionExecutor 执行已验证动作并返回结果或运行句柄；ActionRef 保存定义 ID。Agent、脚本、创建待办和通知支持手动／定时；Obsidian 命令、打开笔记和网页仅手动。AgentSessionApi 提供同一会话快照、订阅、启动、恢复、停止、打开和上下文附加。

## 取舍与约束

入口不复制提示词或运行状态。删除定义保留运行快照并留下明确失效入口。普通 Obsidian 命令只报告已调用；上下文默认附加但不提交，输入未就绪会有界等待。

## 验证依据

[当前源码](../../../../src/core/actions/executor.ts)。pnpm test:automation、pnpm test:panel-composition；验证入口复用、编辑同步、重复启动、失效引用和上下文。

本页描述当前工作区的有效决定，不反写历史实施时间。实际执行结果见[当前基线](../archive/2026-10/2026-10-01-current-baseline/README.md)。
