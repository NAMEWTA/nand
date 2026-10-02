# ADR-0009：图标独立存储与上游行为语义

状态：已接受，当前规范。核对日期：2026-10-01。

## 问题

图标规则与资源有独立偏好和备份语义，不应混入看板模型。

## 决策

图标数据位于 `.nand/icons/iconic.json` 及同目录轮换备份；全局设置只保存模块开关。NAND 管理宿主注册、启停与 UI 注入，保留上游字段、规则次序和独立 oracle。停用释放代理、弹窗和界面修改。

## 取舍与约束

保留 Iconic 1.1.10 固定来源与资源许可证；不能用迁入后的代码生成测试期望。没有独立 Iconic 数据自动导入。

## 验证依据

[当前源码](../../../../src/platform/obsidian/icons/host/controller.ts)。pnpm test:iconic-port 与 pnpm test:settings-nav；核对领域存储、两种设置渲染、备份及停用。

本页描述当前工作区的有效决定，不反写历史实施时间。实际执行结果见[当前基线](../archive/2026-10/2026-10-01-current-baseline/README.md)。
