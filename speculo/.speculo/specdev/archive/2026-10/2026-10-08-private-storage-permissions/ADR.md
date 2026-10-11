# NAND 私有目录和文件的最小POSIX权限 — Change ADR

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 2 票、6 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

## ADR-001: 限定平台与根

**Status:** accepted
**Source:** LOG-001；#144
**Supersedes:** none（本change合同，不改写永久知识）

### Context

JsonStore/DurableState/adapter写入按umask，native SQLite同样会创建文件；浏览器用户数据目录已显式0700/0600，库内目前不一致。

### Decision

仅桌面FileSystemAdapter且POSIX；目录0700文件0600；Windows/mobile/nonfilesystem保持原行为。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。
