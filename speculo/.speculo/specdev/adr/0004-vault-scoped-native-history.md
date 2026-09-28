## ADR-0004: 当前库范围内的只读原生历史

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-workbench.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
CLI 已有会话记录和恢复协议。NAND 需要在库中浏览、搜索和标注历史；扫描全局记录或直接改写原生会话会扩大可见范围并干扰 CLI。

### Decision
只接纳可信工作目录经真实路径解析后属于当前库或其子目录的原生会话。原生日志和 OpenCode SQLite 只读；标题、标签、收藏和归档单独保存在 NAND 元数据中，索引可重建，Markdown 导出独立保存。Rust 后台任务承担解析并支持取消，不在渲染线程或 PTY reactor 中解析日志；恢复前重新核对会话和目录，找不到指定会话时不静默新建。

### Trade-off
替代方案是全局历史聚合，或导入并接管原生日志。当前选择保留 CLI 的数据与恢复权威，接受缺少可信 cwd 的记录不能显示，以及原生格式适配和独立索引成本。

### Consequences
符号链接和相似目录名不能扩大库范围。按文件变化跳过未变记录，已变记录重新完整解析；不宣称字节增量索引或实时文件监视。订阅额度、原生 token 与费用是不同语义，缺失值不得推算成已知；原生解析协议要求同提交配套 Rust 服务。

### Verification / Migration
Rust 内部测试含真实目录范围、只读数据库和取消场景；本次没有验证认证账号、macOS 钥匙串或 Windows 实机。

当前源码核验：
- CODE:<Path>processes/rust-terminal-servers/src/agent_data.rs</Path>
- CODE:<Path>src/platform/obsidian/ai-vault/service.ts</Path>
- CODE:<Path>src/platform/desktop/ai-vault/canonical-cwd.ts</Path>
- CODE:<Path>src/platform/terminal-server/agent-data-client.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
