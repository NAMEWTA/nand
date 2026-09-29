---
schema_version: 3
artifact: "spec"
change: "2026-09-28-issue-37-terminal-release"
status: "ready"
ready_for_tickets: true
sources: ["SOURCE:GitHub#37", "<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/source.md</Path>", "<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnosis.md</Path>", "USER-DECISION:全量分析并编写详实计划；当前工作区严格串行"]
---

# Spec: 发布与插件匹配的终端服务

## 1. 问题与目标

公开最新 Release 仍为 0.0.1，二进制路由仅识别 pty；当前客户端会发 agent_data，旧服务将其解析失败投影为 pty/PARSE_ERROR。并行 PTY 初始化会遇到非自身模块的错误；当前源码服务能够返回对应 requestId 的历史结果。manifest 仍 0.0.1，版本相等检测不能选择尚未发布的新服务。

目标用户：在 NAND 中使用该功能的中文/英文用户。成功是以下外部合同可观察成立；不是“已有文件/已编译/票已写完”。Source 最新复测已通过项保留为回归，详细逐项处理见 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnosis.md</Path>。

非目标：遵循源 issue 最终决定：不加旧服务兼容/版本协商。此次不发布 release，不关闭 issue。原报告完整首次打开 UI 和孤儿 shell 未在本轮 Obsidian 实测。

## 2. 解决方案与外部行为

- 新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。
- 新 Release 默认安装首次终端成功、历史/用量/导出/恢复可用，关闭后无孤儿进程，控制台无 agent_data 解析错误。

正常路径按既有业务入口进入，失败路径保留输入和数据，不静默选错目标/改写身份。不跨设备执行自动化，不扩大历史目录范围；语言仅影响系统文案，不改变用户内容。

## 3. 用户故事

- **US-001**：作为用户，我希望新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。 对应合同：AC-001, AC-002

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。 | T-01 的真实行为接缝与 E2E |
| AC-002 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 新 Release 默认安装首次终端成功、历史/用量/导出/恢复可用，关闭后无孤儿进程，控制台无 agent_data 解析错误。 | T-01 的真实行为接缝与 E2E |

## 5. 范围

IN：本 spec 的合同；REUSE：既有 host/核心 service、Preact、原生 Setting、翻译入口、错误和存储端口。

OUT / OOS-001：遵循源 issue 最终决定：不加旧服务兼容/版本协商。此次不发布 release，不关闭 issue。原报告完整首次打开 UI 和孤儿 shell 未在本轮 Obsidian 实测。

视觉旧问题先通过当前宿主复测确认，已满足的行为只加必要回归而不再修改；未确认不是可以省略验收。

## 6. 已锁定实现约束

- DEC-001：保持 plugin/view/platform/core/shared 依赖方向、固定 view type 与显式注入 host；来源为项目 dev 技能和永久 ADR。
- DEC-002：自动化调度游标与通知回执独立于可见历史；来源 <Path>{roots.state}/specdev/adr/0007-device-owned-durable-automation.md</Path>、<Path>{roots.state}/specdev/adr/0008-independent-notification-receipts.md</Path>。
- DEC-003：只有 A 能改永久知识；开发成果位于本 change，docs 只放外部用户操作说明。

## 7. 数据、接口与兼容

保持现有业务身份和持久化来源；仅按 Ticket 明示的目标调整呈现/入口。新增资源或可选字段必须保留旧数据读取，禁止清空存储。

发布为本问题的交付一部分，但远程动作单独授权；不支持旧0.0.1协议协商。

## 8. 非功能要求

- NFR-001：测试使用合成资料，无真实账户凭据；用户内容和原生日志不可被诊断/修复静默改写。
- NFR-002：语言或UI更新不重建 PTY、不泄漏订阅；性能阈值沿项目已有合同，不编造数字。
- NFR-003：保存失败不可发布成功状态；恢复与重复操作保持原有幂等规则。
- NFR-004：错误可定位到真实原因；Evidence 明确区分自动夹具、静态核对与真实宿主验证。

## 9. 验证策略

现有回归先例：- `cargo test --manifest-path processes/rust-terminal-servers/Cargo.toml`
- `node scripts/verify-pty-automation.mjs`
- `pnpm test:terminal-agent`

每个 AC 的执行接缝在对应 Ticket 验证矩阵。现有红灯命令与单变量日志在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/</Path>。所有运行证据保存到各 Ticket Evidence；不得用当前探针或历史截图替代实现后的 E2E。

## 10. 风险、假设与未决问题

行为合同已锁定，ready_for_tickets=true；实施/提交/发布尚未授权，Goal 不能执行。可逆细节（函数/文件拆分、符合既有 token 的样式值）由实施者选择并验证。真实宿主的视觉子项可能已经修复；实施前证实并记录，无需为旧截图制造修改。


