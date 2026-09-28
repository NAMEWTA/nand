---
schema_version: 3
artifact: "spec"
change: "2026-09-28-issue-39-widget-source"
status: "ready"
ready_for_tickets: true
sources: ["SOURCE:GitHub#39", "<Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/source.md</Path>", "<Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/diagnosis.md</Path>", "USER-DECISION:全量分析并编写详实计划；当前工作区严格串行"]
---

# Spec: 小组件提醒可靠返回看板来源

## 1. 问题与目标

DashboardAutomationSource.files 会补 .md 查找文件，但 widgets.source.path 直接复制 dashboardFile 配置；composition open 用精确 getFileByPath，不做同样规范化。通知与自动化共用该入口，所以两处同错。

目标用户：在 NAND 中使用该功能的中文/英文用户。成功是以下外部合同可观察成立；不是“已有文件/已编译/票已写完”。Source 最新复测已通过项保留为回归，详细逐项处理见 <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/diagnosis.md</Path>。

非目标：不更改提醒时间、定义 id/revision、设备归属、投递游标，不迁移档案/待办来源协议。

## 2. 解决方案与外部行为

- 倒计时/纪念日来源带真实可解析看板路径，从通知或自动化点击能打开所属看板并定位对应 widget id。
- 读取旧省略.md的 widget 来源可打开；文件/部件确实被删时提示清楚且无 Error: 前缀；不误报重复任务标识。

正常路径按既有业务入口进入，失败路径保留输入和数据，不静默选错目标/改写身份。不跨设备执行自动化，不扩大历史目录范围；语言仅影响系统文案，不改变用户内容。

## 3. 用户故事

- **US-001**：作为用户，我希望倒计时/纪念日来源带真实可解析看板路径，从通知或自动化点击能打开所属看板并定位对应 widget id。 对应合同：AC-001, AC-002

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 倒计时/纪念日来源带真实可解析看板路径，从通知或自动化点击能打开所属看板并定位对应 widget id。 | T-01 的真实行为接缝与 E2E |
| AC-002 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 读取旧省略.md的 widget 来源可打开；文件/部件确实被删时提示清楚且无 Error: 前缀；不误报重复任务标识。 | T-01 的真实行为接缝与 E2E |

## 5. 范围

IN：本 spec 的合同；REUSE：既有 host/核心 service、Preact、原生 Setting、翻译入口、错误和存储端口。

OUT / OOS-001：不更改提醒时间、定义 id/revision、设备归属、投递游标，不迁移档案/待办来源协议。

视觉旧问题先通过当前宿主复测确认，已满足的行为只加必要回归而不再修改；未确认不是可以省略验收。

## 6. 已锁定实现约束

- DEC-001：保持 plugin/view/platform/core/shared 依赖方向、固定 view type 与显式注入 host；来源为项目 dev 技能和永久 ADR。
- DEC-002：自动化调度游标与通知回执独立于可见历史；来源 <Path>{roots.state}/specdev/adr/0007-device-owned-durable-automation.md</Path>、<Path>{roots.state}/specdev/adr/0008-independent-notification-receipts.md</Path>。
- DEC-003：只有 A 能改永久知识；开发成果位于本 change，docs 只放外部用户操作说明。

## 7. 数据、接口与兼容

保持现有业务身份和持久化来源；仅按 Ticket 明示的目标调整呈现/入口。新增资源或可选字段必须保留旧数据读取，禁止清空存储。

本轮不改变发行版本或远程状态；实现后按正常插件构建交付。

## 8. 非功能要求

- NFR-001：测试使用合成资料，无真实账户凭据；用户内容和原生日志不可被诊断/修复静默改写。
- NFR-002：语言或UI更新不重建 PTY、不泄漏订阅；性能阈值沿项目已有合同，不编造数字。
- NFR-003：保存失败不可发布成功状态；恢复与重复操作保持原有幂等规则。
- NFR-004：错误可定位到真实原因；Evidence 明确区分自动夹具、静态核对与真实宿主验证。

## 9. 验证策略

现有回归先例：- `pnpm test:automation`
- `pnpm test:panel-composition`

每个 AC 的执行接缝在对应 Ticket 验证矩阵。现有红灯命令与单变量日志在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/diagnostics/</Path>。所有运行证据保存到各 Ticket Evidence；不得用当前探针或历史截图替代实现后的 E2E。

## 10. 风险、假设与未决问题

行为合同已锁定，ready_for_tickets=true；实施/提交/发布尚未授权，Goal 不能执行。可逆细节（函数/文件拆分、符合既有 token 的样式值）由实施者选择并验证。真实宿主的视觉子项可能已经修复；实施前证实并记录，无需为旧截图制造修改。


