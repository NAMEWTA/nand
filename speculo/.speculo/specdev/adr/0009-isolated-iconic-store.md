## ADR-0009: Iconic 保留独立领域数据与上游语义

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/icons.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
Iconic 移植覆盖多种宿主界面和成熟规则语义。直接拼入 NAND 主设置或再创建一个 Plugin 会造成数据归属和启停冲突，也会让上游对照失去明确边界。

### Decision
Iconic 作为 NAND 可启停领域集成，保留独立 iconic.json 及备份、上游字段和规则语义；主 data.json 只保存模块开关。宿主注册由 NAND 管理，单次激活的资源和代理在停用时清理；原生管理器通过注入的界面操作请求对话框。固定上游 oracle 独立保留，不能从迁入后的实现生成期望值。

### Trade-off
统一主设置可简化一个保存入口，但要重写上游存储与偏好行为；嵌入完整第二插件能少改移植源码，却引入重复注册和卸载归属。当前选择领域适配并承担双存储和原生补丁生命周期维护成本，以保留可对照行为。

### Consequences
默认使用实际配置目录和插件 manifest ID，不硬编码安装路径。独立 Iconic 不自动导入，不能同时驱动同一界面。上游资源许可证进入产物；版本差异、已知交互差异与未复现问题保留在带日期的迁移证据，不因本次沉淀宣称已修复。

### Verification / Migration
test:iconic-port 的固定 1.1.10 oracle 检查规则、默认值、资源与生命周期；配合 test:settings-nav 检查两种设置入口。

当前源码核验：
- CODE:<Path>src/platform/obsidian/icons/persistence/store.ts</Path>
- CODE:<Path>src/platform/obsidian/icons/host/controller.ts</Path>
- CODE:<Path>src/core/icons/settings/model.ts</Path>
- CODE:<Path>scripts/verify-iconic-port.ts</Path>
- CODE:<Path>scripts/fixtures/iconic/README.md</Path>
- CODE:<Path>esbuild.config.mjs</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
