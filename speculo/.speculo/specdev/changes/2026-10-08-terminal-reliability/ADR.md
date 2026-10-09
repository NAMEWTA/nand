# 终端 helper 可安装性、错误反馈与句柄隔离 — Change ADR

## ADR-001: 同版本下载不降级

**Status:** accepted
**Source:** LOG-001；#135及dev licensing
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前0.0.1-alpha.1 Release已有五平台helper和校验和；旧1.0.0背景不再成立。BinaryError含message但controller映射为笼统http文案；main.rs尚无继承FD清理。

### Decision

保持当前同版本资产+校验和合同，不静默回退旧GPL/旧协议helper，404指明未发布。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-002: Unix清理时点

**Status:** accepted
**Source:** LOG-002；#143
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前0.0.1-alpha.1 Release已有五平台helper和校验和；旧1.0.0背景不再成立。BinaryError含message但controller映射为笼统http文案；main.rs尚无继承FD清理。

### Decision

第一步清理继承的fd≥3，再创建job/channel/thread/PTY/history；保留0/1/2且Windows不执行POSIX代码。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。
