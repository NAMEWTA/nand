# 当前架构决策候选

本文件是九项毕业候选的唯一正文；验证后各自提升，归档保留本次来源版本。

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

## ADR-0005: 档案以可见 Markdown 为资料来源

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts-development.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
档案需要面板编辑，也需在停用插件后直接阅读、备份和提供给 AI。显示名称和路径会变化，同名人物不能共享身份；企业人员与关系两侧显示不能产生互相冲突的双写。

### Decision
人物与企业各保存为配置目录中的可见 Markdown；nand-id 是稳定身份，nand-type 是类型。内存索引可重建，插件设置不保存实体正文。任职保存在人物，企业人员从任职派生；直接关系保存在录入方，反向展示派生。保存对基本字段和整段正文区域做三方合并，保留未知内容；同字段或同表并发修改拒绝覆盖。

### Trade-off
数据库作为唯一来源更易查询，但脱离插件后需要额外导出；整文重写简单，但会覆盖用户正文；双侧持久化关系便于直接读取，却增加一致性维护。当前选择承担 Markdown 解析、稳定身份和冲突检查的复杂度，以保留文件可用性和单一事实源。

### Consequences
改名不改变身份，不自动重命名文件；切换目录只切换数据源。删除不级联改写其他档案；失效关联保留历史。资料目录备份应包含附件，恢复需保留原身份。原始笔记未保存或结构损坏时拒绝面板覆盖；应用内三方合并不承诺跨设备同步冲突协调。

### Verification / Migration
格式协议以 CODE:<Path>src/core/contacts/persist/format-guide.md</Path> 为准。test:contacts 覆盖往返、未知内容保留、身份、派生关系和冲突；历史实机清单不等于全通过。

当前源码核验：
- CODE:<Path>src/core/contacts/model.ts</Path>
- CODE:<Path>src/core/contacts/persist/markdown.ts</Path>
- CODE:<Path>src/core/contacts/index-store.ts</Path>
- CODE:<Path>src/core/contacts/application.ts</Path>
- CODE:<Path>src/platform/obsidian/contacts/controller.ts</Path>
- CODE:<Path>scripts/verify-contacts.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。

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

## ADR-0007: 设备所属自动化先持久化再执行

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/automation.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
同步库可能在多设备打开，Agent 动作又具有外部副作用。调度若仅依赖内存或在重启后补放全部任务，可能重复提交提示词或重复创建待办。

### Decision
自动化属于指定执行设备，设备身份保存于 Obsidian 本机存储，独立定义、游标和运行快照按设备保存。来源定义由看板、档案或部件持有；组合根通过端口访问，不把笔记事实复制成独立主数据。外部动作开始前先持久化运行及调度游标；重启将未完成运行标为中断而不自动重放。调度只在 Obsidian 运行时工作。

### Trade-off
云端或系统守护调度可在宿主退出后执行，但会引入远程运行和新的生命周期；重放错过任务偏重补齐，却可能重复副作用。当前选择设备本地、有限补偿和中断可见，接受应用关闭时不能执行以及崩溃后需人工判断是否再运行。

### Consequences
错过时间只评估最近一次，过宽限或忙碌记录跳过；删除定义保留运行快照。来源扫描和首轮 tick 等布局就绪，不能让插件 onload 等待一个同样等待布局的索引。完成状态依赖原生生命周期或真实退出，不以静默推断；用量缺失不改变原生完成结果。

### Verification / Migration
test:automation 覆盖并发 tick、持久化失败、重启中断、来源写回和 hook；这不构成严格 exactly-once 外部副作用保证。

当前源码核验：
- CODE:<Path>src/core/automations/service.ts</Path>
- CODE:<Path>src/plugin/workflows/automation-host.ts</Path>
- CODE:<Path>src/shared/automation/types.ts</Path>
- CODE:<Path>src/platform/desktop/agent-hooks/native-extensions.ts</Path>
- CODE:<Path>scripts/verify-automation.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。

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
