## ADR-0003: 终端会话与叶子生命周期分离

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-workbench.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
定时 Agent 运行可能没有任何终端叶子。将 PTY 生命周期绑定到标签关闭，会意外终止任务；为了后台运行创建不可见浏览器终端又把会话依赖回 UI。

### Decision
TerminalService 持有原生 PtySession 和 DOM 无关的 headless VT 缓冲；视图按需取得浏览器 xterm 表现。关闭叶子解除绑定并保留会话；关闭会话销毁进程；停用终端模块或卸载插件销毁全部所属会话。重新连接恢复输出，不重新提交旧提示词。

### Trade-off
叶子直接拥有进程能简化清理，但无法满足后台自动化与关闭再接回；独立持久守护进程可跨宿主退出继续运行，但超出当前插件能力。当前会话独立于叶子，却仍受插件服务生命周期约束，代价是两套资源需分别释放。

### Consequences
叶子存在不等于会话存活，会话存在也不要求渲染器存在。模块关闭必须同时释放原生服务和渲染资源；插件或 Obsidian 重启不保证恢复原进程，不得自动重放提示词。

### Verification / Migration
原生会话测试与历史 runtime 记录覆盖后台输出、叶子关闭和卸载；当前文档整理不新增运行时验收。

当前源码核验：
- CODE:<Path>src/platform/desktop/terminal/terminal-service.ts</Path>
- CODE:<Path>src/platform/desktop/terminal/pty-session.ts</Path>
- CODE:<Path>src/view/terminal/runtime/terminal-renderers.ts</Path>
- CODE:<Path>src/view/terminal/terminal-view.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
