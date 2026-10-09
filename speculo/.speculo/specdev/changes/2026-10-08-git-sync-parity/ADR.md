# Git 同步对照补齐、仓库边界与失败恢复 — Change ADR

## ADR-001: 保持桌面系统Git

**Status:** accepted
**Source:** LOG-001；#134逐项说明允许+当前ADR0012
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

### Decision

复用credential/SSH，不引入移动isomorphic-git；移动端明确不支持，子模块/blame/行级暂存列能力差异。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-002: 安全策略

**Status:** accepted
**Source:** LOG-002；#134
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

### Decision

merge/rebase显式选；不提供reset或自动force-push；squash默认关，按实际目标核实只改未推送历史。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-003: clone补齐

**Status:** accepted
**Source:** LOG-003；#134接入要求
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

### Decision

提供用户主动选择的新空目录clone向导，不向当前非空vault写clone，也不自动切换库。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-004: 范围失败闭合

**Status:** accepted
**Source:** LOG-004；#134不得意外提交库外文件
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

### Decision

父repo中有范围外暂存时停止提交并提示用户处理，不移动/丢弃这些暂存；不凭UI过滤假装安全。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-005: Git实际推送目标合同

**Status:** accepted
**Source:** LOG-005；#134安全同步要求、固定参考pushTarget实现与当前core源码事实
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

### Decision

push和squash使用系统Git解析的实际push远端/ref；不同pull upstream可用，无法唯一解析时不改写历史。所有index修改含unstage-all严格限制vault。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。
