## ADR-0007: 设备所属自动化先持久化再执行

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/automation.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
同步库可能在多设备打开，Agent 动作又具有外部副作用。调度若仅依赖内存或在重启后补放全部任务，可能重复提交提示词或重复创建待办。

### Decision
自动化属于指定执行设备，设备身份保存于 Obsidian 本机存储，独立定义、游标和运行快照按设备保存。来源定义由看板、档案或部件持有；组合根通过端口访问，不把笔记事实复制成独立主数据。外部动作开始前先持久化运行及调度游标；重启将未完成运行标为中断而不自动重放。调度只在 Obsidian 运行时工作。

### Trade-off
云端或系统守护调度可在宿主退出后执行，但会引入远程运行和新的生命周期；重放错过任务偏重补齐，却可能重复副作用。当前选择设备本地、有限补偿和中断可见，接受应用关闭时不能执行以及崩溃后需人工判断是否再运行。

### Consequences
错过时间只评估最近一次，过宽限或忙碌记录跳过；删除定义保留运行快照。来源扫描和首轮 tick 等布局就绪，不能让插件 onload 等待一个同样等待布局的索引。完成状态依赖原生生命周期或真实退出，不以静默推断；用量缺失不改变原生完成结果。

### Verification / Migration
test:automation 覆盖并发 tick、持久化失败、重启中断、来源写回和 hook；这不构成严格 exactly-once 外部副作用保证。

当前源码核验：
- CODE:<Path>src/core/automations/service.ts</Path>
- CODE:<Path>src/plugin/workflows/automation-host.ts</Path>
- CODE:<Path>src/shared/automation/types.ts</Path>
- CODE:<Path>src/platform/desktop/agent-hooks/native-extensions.ts</Path>
- CODE:<Path>scripts/verify-automation.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
