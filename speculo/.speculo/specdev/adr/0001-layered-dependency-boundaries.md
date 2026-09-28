## ADR-0001: 五层依赖边界

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor.md</Path>
**Supersedes:** none

### Context
看板、终端、自动化等功能共享一个 Obsidian 插件进程，但 UI、宿主 IO 和领域规则的生命周期不同。按产品将所有责任放在同一树里会让存储、业务和视图互相导入，限制无界面执行及测试。

### Decision
采用 plugin → view → platform → core → shared 的允许依赖矩阵：plugin 可依赖所有层；view 可依赖 view/platform/core/shared；platform 可依赖 platform/core/shared；core 可依赖 core/shared；shared 只依赖 shared。类型导入也受约束，禁止内部回引包围自己的聚合入口和运行时循环。plugin 是组合根，跨领域协调通过显式端口注入；平台层不导入视图，业务面板不导入插件类。

### Trade-off
替代方案是继续让产品目录同时拥有控制器、IO 与视图，或拆成独立发布包和进程。当前选择承担端口和组装代码的成本，以便领域规则脱离宿主且功能可独立启停；不把同一插件改造成桌面多进程应用。

### Consequences
源文件移动不等于持久化标识迁移。原视图类型、数据文件与用户笔记协议保持；不增加旧源码入口兼容层。新增跨领域能力由组合根连接，不能在 shared 塞入任意功能模型。

### Verification / Migration
pnpm test:architecture 检查方向、宿主依赖、聚合回引及静态可解析的运行时循环；计算出的动态模块名不在静态证明范围内。

当前源码核验：
- CODE:<Path>scripts/verify-architecture.mjs</Path>
- CODE:<Path>src/plugin/workflows/automation-host.ts</Path>
- CODE:<Path>src/core/contacts/application.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
