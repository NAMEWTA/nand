# ADR-0004：当前库范围内的只读原生历史

状态：已接受，当前规范。核对日期：2026-10-01。

## 问题

CLI 历史与身份由 CLI 管理，工作台不能把全局历史混入当前库。

## 决策

按真实工作目录筛选当前 Vault 及其子目录的原生会话。CLI 日志保持只读；NAND 标注和可重建索引位于 `.nand/terminal-agent/<device-id>/`。恢复使用准确的原生标识，不存在时报告错误。导出写入可见 NAND Exports/，同名不覆盖。

## 取舍与约束

用量以原生日志与提供方状态为来源，缺失显示未知；费用不按模型单价推算。账号认证与日志不复制进 Vault。

## 验证依据

[当前源码](../../../../src/platform/terminal-server/agent-data-client.ts)。pnpm test:terminal-agent；覆盖真实路径范围、历史分页与搜索、恢复失败、原始用量和导出。

本页描述当前工作区的有效决定，不反写历史实施时间。实际执行结果见[当前基线](../archive/2026-10/2026-10-01-current-baseline/README.md)。
