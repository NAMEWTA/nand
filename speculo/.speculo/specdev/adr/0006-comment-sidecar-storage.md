## ADR-0006: 评论旁路保存且不改写笔记

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-23-25-fixes.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-fixes-2026-09-27.md</Path>
**Supersedes:** none

### Context
评论属于笔记协作信息，不应通过改写 Markdown 实现高亮和线程显示；放入插件主设置又使正文评论与插件安装目录耦合。

### Decision
评论正文和索引保存在库内 .nand/editor/comments 下的旁路 JSON 文件；通过文件、选区与原文锚点关联笔记，笔记文本不因评论操作被重写。编辑器扩展和阅读处理器属于宿主注册生命周期，面板关闭仅卸载 UI；模块停用清理浮层并刷新、释放评论存储。

### Trade-off
把评论插入笔记可随纯文本流转，但会污染正文并影响选区；保存到插件 data.json 简单，但与库内容分离且形成集中写入。当前选择独立的库级旁路存储，承担锚点随编辑、重命名与失效状态维护的成本。

### Consequences
只复制 Markdown 不等于备份评论。划选浮层须绑定来源笔记与选区，提交前重新验证来源可见性；暂时隐藏可保留有效草稿，失效来源不能写评论。四边定位、Scope 和无障碍修复属于维护细节，历史 bug 过程留在证据而非另建 ADR。

### Verification / Migration
test:editor-comments 与 test:issue-regressions 检查旁路存储、来源失效及快捷键范围；历史 GUI 有文件监听绕过限制。

当前源码核验：
- CODE:<Path>src/core/comments/store.ts</Path>
- CODE:<Path>src/core/comments/anchor.ts</Path>
- CODE:<Path>src/platform/obsidian/comments/vault-fs.ts</Path>
- CODE:<Path>src/view/editor/comments/popover-coordinator.ts</Path>
- CODE:<Path>src/view/editor/comments/selection-popover.ts</Path>
- CODE:<Path>scripts/verify-editor-comments.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
