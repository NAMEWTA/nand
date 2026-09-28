## ADR-0002: 原生宿主生命周期与 Preact 业务界面

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review-2026-09-26.md</Path>
**Supersedes:** none

### Context
叶子、弹窗与弹出窗口由 Obsidian 管理，xterm、CodeMirror、Chart.js 和 MarkdownRenderer 又有自己的资源生命周期。仅把原命令式业务渲染器塞进 effect 不会取得可组合、可局部更新的界面。

### Decision
保留原生 Plugin、Component、ItemView、Modal、Setting、Menu 及注册卸载；业务内容由 Preact 函数组件接收状态、操作和窄宿主能力。设置与原生 chrome 保留原生 API，专业渲染器进入稳定容器并由接入 effect 清理。看板根记录所属组件、图表与交互状态，卸载前释放；异步结果不得复活旧面板。窗口相关事件和计时器归所属 Window，跨窗口迁移重新接入。

### Trade-off
全原生 DOM 简化初期接线，但刷新容易重建输入和列表；全交给前端框架则会重复宿主焦点、菜单和窗口机制。采用混合所有权，接受原生容器与组件接入代码，以保持宿主行为并支持业务面板组合。

### Consequences
关闭弹窗必须卸载组件；模块关闭和插件卸载关闭其业务弹窗。组件重复刷新需保留输入和滚动，Markdown/视频/计时器有明确清理。叶内渲染可直接挂 contentEl；跨叶拖拽层才使用同窗口根和 portal，不将每个面板误写成全局单根。

### Verification / Migration
test:card-panels、test:dashboard-isolation、test:panel-composition 提供自动检查。历史截图不能证明完整迁移后的 GUI 已验收。

当前源码核验：
- CODE:<Path>src/view/dashboard/renderer/render-context.ts</Path>
- CODE:<Path>src/view/dashboard/ui/panel-modal.ts</Path>
- CODE:<Path>src/view/dashboard/view/lifecycle.ts</Path>
- CODE:<Path>scripts/verify-card-panels.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
