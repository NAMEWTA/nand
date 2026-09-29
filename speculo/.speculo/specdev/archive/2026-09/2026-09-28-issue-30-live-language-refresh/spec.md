---
schema_version: 3
artifact: "spec"
change: "2026-09-28-issue-30-live-language-refresh"
status: "ready"
ready_for_tickets: true
sources: ["SOURCE:GitHub#30", "<Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/source.md</Path>", "<Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/diagnosis.md</Path>", "USER-DECISION:全量分析并编写详实计划；当前工作区严格串行"]
---

# Spec: 语言切换即时更新命令与宿主标题

## 1. 问题与目标

插件 addCommand 仅对 nameKey 建订阅；评论/复制命令与预设工作流只提供启动时的 name。AutomationView、ContactsView、TerminalView 的语言监听只重绘业务内容，未通知宿主刷新标题。

目标用户：在 NAND 中使用该功能的中文/英文用户。成功是以下外部合同可观察成立；不是“已有文件/已编译/票已写完”。Source 最新复测已通过项保留为回归，详细逐项处理见 <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/diagnosis.md</Path>。

非目标：不迁移已稳定的 ribbon ID，不重新创建会话或改变 view type。

## 2. 解决方案与外部行为

- 语言双向切换后评论、两种复制引用及六个内置工作流命令立即显示当前语言，不须重启。
- 自定义脚本名称原样保留，只翻译工作流前缀；注册命令 ID 与快捷键不变。
- 所有已打开 NAND 叶子在 zh↔en 时即时更新标题并保持当前选中项/会话；延迟加载叶子加载后使用当前语言。
- 标题刷新不卸载 PTY 或丢失 Preact 状态；保留固定 view type 与 ribbon ID。

正常路径按既有业务入口进入，失败路径保留输入和数据，不静默选错目标/改写身份。不跨设备执行自动化，不扩大历史目录范围；语言仅影响系统文案，不改变用户内容。

## 3. 用户故事

- **US-001**：作为用户，我希望语言双向切换后评论、两种复制引用及六个内置工作流命令立即显示当前语言，不须重启。 对应合同：AC-001, AC-002
- **US-002**：作为用户，我希望所有已打开 NAND 叶子在 zh↔en 时即时更新标题并保持当前选中项/会话；延迟加载叶子加载后使用当前语言。 对应合同：AC-003, AC-004

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 语言双向切换后评论、两种复制引用及六个内置工作流命令立即显示当前语言，不须重启。 | T-01 的真实行为接缝与 E2E |
| AC-002 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 自定义脚本名称原样保留，只翻译工作流前缀；注册命令 ID 与快捷键不变。 | T-01 的真实行为接缝与 E2E |
| AC-003 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 所有已打开 NAND 叶子在 zh↔en 时即时更新标题并保持当前选中项/会话；延迟加载叶子加载后使用当前语言。 | T-02 的真实行为接缝与 E2E |
| AC-004 | 当前基线、合成正常/边界/失败输入 | 用户执行对应操作或切换状态 | 标题刷新不卸载 PTY 或丢失 Preact 状态；保留固定 view type 与 ribbon ID。 | T-02 的真实行为接缝与 E2E |

## 5. 范围

IN：本 spec 的合同；REUSE：既有 host/核心 service、Preact、原生 Setting、翻译入口、错误和存储端口。

OUT / OOS-001：不迁移已稳定的 ribbon ID，不重新创建会话或改变 view type。

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

现有回归先例：- `pnpm test:issue-regressions`
- `pnpm test:settings-nav`
- `pnpm test:panel-composition`
- `pnpm test:terminal-agent`

每个 AC 的执行接缝在对应 Ticket 验证矩阵。现有红灯命令与单变量日志在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/diagnostics/</Path>。所有运行证据保存到各 Ticket Evidence；不得用当前探针或历史截图替代实现后的 E2E。

## 10. 风险、假设与未决问题

行为合同已锁定，ready_for_tickets=true；实施/提交/发布尚未授权，Goal 不能执行。可逆细节（函数/文件拆分、符合既有 token 的样式值）由实施者选择并验证。真实宿主的视觉子项可能已经修复；实施前证实并记录，无需为旧截图制造修改。


