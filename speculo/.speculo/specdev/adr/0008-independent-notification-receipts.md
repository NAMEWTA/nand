## ADR-0008: 通知回执独立于可见收件箱

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/automation.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
通知已经提交但确认尚未保存时，崩溃后的状态不确定。若删除已读通知也删除投递依据，再次发布同一运行会重复通知。

### Decision
发送前先持久化每个渠道的投递占位，回执以通知 ID 独立保存。可见收件箱记录可以清理，但去重回执保留；重启后 pending 回执转为 unknown，不自动重试。发送、结果更新和读状态变更经过串行持久化，存储失败不发布成功状态。

### Trade-off
把回执和可见记录合为一体节省存储，却让历史清理触发重复投递；不确定时自动重试偏重送达，但会制造重复通知。当前选择保留去重依据，接受不确定通知可能实际没有送达及回执存储增长。

### Consequences
已读、已送达和已执行是不同状态。清理收件箱不能改变运行结果；unknown 不等同成功或失败。后续回执回收策略不能仅依据可见记录是否存在，必须另行决定安全的去重期限。

### Verification / Migration
test:automation 包含清理已读后重启仍去重、记录裁剪后不重投和加载失败保护。

当前源码核验：
- CODE:<Path>src/core/notifications/service.ts</Path>
- CODE:<Path>src/platform/obsidian/notifications/delivery.ts</Path>
- CODE:<Path>scripts/verify-automation.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
