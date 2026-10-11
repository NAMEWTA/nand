---
schema_version: 3
plan_contract_version: 1
plan_revision: 3
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-home-grid-rebuild"
status: "completed"
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Tickets Map: 首页看板自由网格、组件贡献与智能体技能派发

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 18 票、77 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/goal-plan.md</Path>

## 1. 目标与拆分策略

先独立修复 #141 的窄桌面快捷创建栏异常高度和横幅遮挡；随后完整落实 #137：固定参考 apex-dashboard 3.7.5 源码，形成按看板布局/成员、沉浸式统一网格、内外部小组件贡献、NAND 终端技能派发、工作流分区以及全部八项附加体验。遵守现有模块边界、懒加载、全局主题、Markdown 保真、i18n 与许可；RSS 产品由新闻 change 实现。本次交付是成熟规格、18 张票与串行计划，不执行实现或发布。

### 总体实施背景

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

源/许可锚点：apex 主树 https://github.com/PandoraReads/apex-dashboard/tree/db9d2892032c27f5f8899a72c0dca61d72572a9a 。具体适配映射覆盖 immersive-grid.ts、immersive.ts、parser.ts/types.ts、agent-dispatch.ts、agent-prompt-modal.ts、skill-registry.ts、pipeline-*.ts、table-columns-modal.ts、library-section.ts、anniversary-*.ts、focal-point-picker.ts、theme-studio-modal.ts、icon-picker-modal.ts。原始研究为 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>；其中记录已读实现和不应照搬的缺陷。GPL 只读固定 README/LICENSE 的事实可追溯，不把其 README 技术例子改成实现。

Board 模型在 <Path>src/modules/home/core/board/types/model.ts</Path> 增加 layout?: 'side'|'stacked'|'immersive'、widgets?: BoardWidgetMember[]、immersive?: ImmersiveTile[]、skills?: SkillShortcut[]。member 包含 memberId、provider（ModuleId）、kind（provider 内稳定 key）、instanceId、可选 label/icon 元数据；数组顺序就是 side/stacked 成员顺序。tile.id 引用 memberId、稳定 cardId 或持久 section id；既有 section 无 id 时只在首次编辑分配并记录映射，重命名不能丢布局。tile 包含 w、cap（10px 细行）、fixed?、x?、y?；内存 h 与 cap 只在 codec 边界转换，不存两个独立权威。x/y 必须成对、有限、非负；w限制1..12，最小 cap 为3、上限240，并结合贡献最小尺寸。legacy h 在解析边界一次迁移，保存只写 cap；避免每次加载将小 cap 再膨胀。传统布局的 size/width/half/height 仍可读，immersive 使用单一 tile，原 gridCols/gridRows/gridCol/gridRow 回调若无用途则删除并保留原文兼容。

HOME_WIDGETS 定义于 <Path>src/modules/home/api.ts</Path>，仅导出类型和 contributionPoint 常量，不静态拉入 UI。贡献描述包含 key、localized name/key、icon、defaultSize/minSize、multiple?、configuration/create 入口与 render(host,ctx)；ctx 提供 boardPath/memberId/instanceId、owner document/window、只读配置和经所属服务执行的操作、AbortSignal/lifetime。挂载返回 dispose 或明确实例 dispose，dispose 幂等且不会删数据。module.ts 通过 lazy render loader 配置内置贡献；news 从自己的 api/contrib 声明贡献，home 不导入 news UI。布局成员和 widget instance 配置分离：会员缺席、模块缺席和实例被用户真正删除是不同状态；未知 provider 保留数据并占位。

迁移以 existing parse(document) → normalized projection 为只读操作；parse 初始化的 source/baseline 必须在所有投影转换之后正确构造，使未修改 serialize 完全返回 source。编辑通过 <Path>src/modules/home/platform/board/sync.ts</Path> 与 preserveDashboardDocument 的正常保存通道，仅写已管理字段差异；不能用 upstream serialize 重建全文。旧全局 enables/widgetOrder（含 family keys）按当前真实渲染规则展开到每看板，stacked 的 quickActions 旧 pinned-first 行为要进入迁移投影。新成员和坐标第一次在用户布局/成员编辑提交时落 YAML；普通打开、模块开关、窗口resize不写。模板列表、focal、pipeline、skills 的新格式加 golden；旧 fixtures 不 blanket 更新。

SkillShortcut 包含 id/label/icon、agentId、skillName、promptTemplate、inputPlaceholder?、directSend=false、destination:{kind:'fresh',cwd} 或 {kind:'existing',sessionId}，scope 由入口决定。已存 sessionId 失效时显示重新选择，不自动改为 fresh。pipeline skill 另含 scope:'stage'|'card'、适用stage值列表；旧 section directSend 只在技能缺失显式值时迁移，写回每按钮。board技能持久化 YAML；已记住技能名按 agent 保存在 agent 命名空间，显式额外目录 device scope。模板纯函数在 shared/agent-prompt.ts 接 spec + vars + target token capability，返回 string/结构化 validation error，无 Obsidian/DOM/Node。

agent/api.ts 新公开 AGENT_DISPATCH接受 source:{kind,path,id}、agentId、destination、完整 finalPrompt、files、idempotency invocationId；返回 {invocationId,delivery:'started'|'pasted'|'timeout'|'rejected',runId?,terminalId?,error?}。端口仅负责统一语义，内部复用现有 AgentRuntimePort/AgentSessionsPort。session summary 增加可选 agentId 供选择校验，保留既有调用兼容；不改变旧 attachMaterial 的只粘贴语义。AUTOMATION_AGENT_RUNTIME 的 owner 仍 agent，canonical key 可移到 agent/api 并在 automations/api 保留原名兼容导出。automations 公开受约束的动态 invocation/receipt 方法，先记录请求再启动/粘贴，记录包含来源与最终 prompt 快照，复用现有 device runtime 路径和通知，不写第二份日志。existing 的 pasted receipt 与 AutomationRun 的模型任务完成状态明确分离，不把纯粘贴硬标 succeeded。所有跨模块访问仅 api，禁止 home 直接导入 agent/automations services。

PipelineConfig 包含 rootFolder/statusField、stages:[{id,value,label,folder?,width?}]、excludeFolders、archiveFolder?、templatePaths?、sortBy、filterFields、skills。stage value trimmed/case-insensitive 匹配但保存用户配置的规范值；新建笔记用该值。root 下的 stage folder 先标准化并拒绝越界，archive 是显式配置 vault 路径；未配置目录只写状态。due/remind 复用已知 frontmatter/automation 元数据，不另起私有日期语法。core/pipeline 保存纯 DTO，不含 App/TFile；platform/pipeline 负责扫描、写 frontmatter、rename/trash，services 协调，ui 展示。

LibraryConfig 增加 templatePaths、tableOrder、tableHidden，保留 templatePath 兼容读；new-template user edit 才改该字段。渐进渲染限额是 UI 状态不写用户笔记：filtered result 经现有 sort 后取500，分组每组初始50与每次50；可见限额及 group totals 不与真实结果总数混淆。AnniversaryConfig 加 calendar:'solar'|'lunar'（缺省 solar），startDate 保持当前阳历 ISO，annual mapper 独立接受 now，不写每年变化的目标日期。

BannerData 新增 imagePos:{[imagePath]:{x,y}}，DashboardCard.coverPosition? 同语义；0..100整百分数、缺失为50/50，移除图片时仅删除该图片无用 focal，路径重命名映射跟随已有资源重命名事件。组合快照在 home.appearancePresets[] 保存 {id,name,theme:{preset,headings,emphasis,accentLight,accentDark,lineHeight},home:{bgImage,bgDim,bgBlur,bgSize,surfaceOpacity,glassBlur,radiusScale,fontScale}}；activeAppearancePresetId 为 home 选择标记。快照仅复制允许字段，不包含 workspaceFiles、按钮、凭证或设备路径。应用通过 SettingsStore.bind('theme',themeSettings) 与 home handle，正常共享持久化文件 .nand/config/settings.json，额外桌面技能目录走 .nand/config/devices/<id>.json。

automations/api由T-07独占公开可取消的typed browser-workflow runner/source/action contribution；模块卸载撤回，既有scheduler持有触发与运行记录。news T-02独占AGENT_PROMPT_RUNNER实现完整prompt结果；browser综合/助手消费它而不另造输出reader。 公开typed workflow扩展由home T-07接通module、manifest、现有editor与AutomationRunList；browser T-19注册实际工作流source/action，缺席时保留定义。 与现有registry每module每point一个value一致，HOME_WIDGETS贡献值固定为provider bundle {kinds: readonly HomeWidgetDescriptor[]}，每模块只注册一次；home内置全部kind同一bundle，news三kind同一bundle。owner收集后按(provider,kind.key)索引，重复kind报错可见而不覆盖；不是一kind一条同point注册。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |
| T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17, T-18 | <Path>.agents/skills/ui/SKILL.md</Path> | 页面/组件/样式/交互 | Map后、Ticket前 | 三栏、tokens、焦点与真实宿主 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/01-quicknote-layout.md</Path> | 在#141复现窗口直接恢复紧凑快捷栏及下方内容，独立完成，不等待沉浸式重构。 | — | standard | medium | yes | Lead | AC-001, AC-002, AC-003 | G-T-01 | done |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/02-board-layout-and-provenance.md</Path> | 让现有side/stacked成为每板可保存选择，同时建立三布局codec与迁移入口，第一份适配代码有完整许可证据。 | T-01 | deep | high | yes | Lead | AC-004, AC-005, AC-006, AC-007 | G-T-02 | done |
| T-03 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/03-home-widget-contributions.md</Path> | 所有内置及外部组件按同一公开贡献契约渲染，各板成员独立且模块关闭不丢位置。 | T-02 | deep | high | yes | Lead | AC-008, AC-009, AC-010, AC-011 | G-T-03 | done |
| T-04 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/04-immersive-grid-surface.md</Path> | 用户首次切immersive即可看到widgets/sections/cards的共同网格，重启与窄屏投影可靠。 | T-02, T-03 | deep | high | yes | Lead | AC-012, AC-013, AC-014, AC-015 | G-T-04 | done |
| T-05 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/05-immersive-accessible-interaction.md</Path> | 用户能用pointer或完全键盘自由排列，任何取消都恢复原位且不写错布局。 | T-04 | deep | high | yes | Lead | AC-016, AC-017, AC-018, AC-019, AC-020 | G-T-05 | done |
| T-06 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/06-widget-catalog-and-board-management.md</Path> | 用户无需离开看板即可创建首个多实例组件、删除/重加成员和调整看板顺序。 | T-03, T-04 | standard | medium | yes | Lead | AC-021, AC-022, AC-023 | G-T-06 | done |
| T-07 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/07-shared-agent-shortcut-dispatch.md</Path> | 从一个可配置技能小组件生成精确prompt，经预览编辑或直发创建真实新agent会话并可追踪结果；公共能力供news/browser复用。 | T-03 | deep | high | yes | Lead | AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030 | G-T-07 | done |
| T-08 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/08-existing-session-context-shortcuts.md</Path> | 用户从快念/卡片或技能组件把准确材料粘贴到指定已有agent输入框，同时看到诚实的待发送回执。 | T-07 | deep | high | yes | Lead | AC-031, AC-032, AC-033, AC-034, AC-035 | G-T-08 | done |
| T-09 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/09-agent-skill-discovery.md</Path> | 无需记住技能名即可从库内/历史/显式桌面目录选择，调用语法按真实agent能力。 | T-07 | standard | medium | yes | Lead | AC-036, AC-037, AC-038, AC-039 | G-T-09 | done |
| T-10 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/10-workflow-section.md</Path> | 配置一个真实笔记工作流，能推进状态/目录、管理清单/截止并给卡片或整列派技能，全部行为可重启恢复。 | T-04, T-08 | deep | high | yes | Lead | AC-040, AC-041, AC-042, AC-043, AC-044, AC-045, AC-046, AC-047 | G-T-10 | done |
| T-11 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/11-multi-note-templates.md</Path> | library/folder可选择多个笔记模板，新建时选一个且不破坏旧templatePath数据。 | T-02 | standard | medium | yes | Lead | AC-048, AC-049, AC-050 | G-T-11 | done |
| T-12 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/12-table-column-preferences.md</Path> | 用户能为每分区保存表格列顺序和显隐，数据变化后偏好仍可靠。 | T-02 | standard | medium | yes | Lead | AC-051, AC-052, AC-053 | G-T-12 | done |
| T-13 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/13-progressive-group-rendering.md</Path> | 大型分组/kanban首次只渲染可用的一屏批次，用户可逐步加载且知道截断范围。 | — | standard | medium | yes | Lead | AC-054, AC-055, AC-056 | G-T-13 | done |
| T-14 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/14-lunar-anniversaries.md</Path> | 用户输入农历日期可无损转换并在每年正确农历日提醒，闰月/短月政策明确。 | — | deep | medium | yes | Lead | AC-057, AC-058, AC-059, AC-060 | G-T-14 | done |
| T-15 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/15-image-focal-points.md</Path> | 用户能为每张横幅图和卡片封面保存独立crop焦点，通过鼠标和键盘都可操作。 | T-02 | standard | medium | yes | Lead | AC-061, AC-062, AC-063 | G-T-15 | done |
| T-16 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/16-named-global-appearance.md</Path> | 按已确认规则保存theme+home完整命名组合，一键恢复全部窗口外观且不引入按板主题。 | — | deep | medium | yes | Lead | AC-064, AC-065, AC-066, AC-067 | G-T-16 | done |
| T-17 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/17-icons-and-card-delete.md</Path> | 用户找到任意宿主图标，并在所有文件卡视图通过可达按钮安全删除，无额外数据或图标系统。 | — | standard | medium | yes | Lead | AC-068, AC-069, AC-070, AC-071 | G-T-17 | done |
| T-18 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/18-integrated-home-acceptance.md</Path> | 在全部feature和news贡献可用后验证完整用户旅程，交付可追溯的双语文档、许可和实际证据。 | T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17 | deep | high | yes | Lead | AC-072, AC-073, AC-074, AC-075, AC-076, AC-077 | G-T-18 | done |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- T-01
T-03 <- T-02
T-04 <- T-02, T-03
T-05 <- T-04
T-06 <- T-03, T-04
T-07 <- T-03
T-08 <- T-07
T-09 <- T-07
T-10 <- T-04, T-08
T-11 <- T-02
T-12 <- T-02
T-13 <- ROOT
T-14 <- ROOT
T-15 <- T-02
T-16 <- ROOT
T-17 <- ROOT
T-18 <- T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | 真实Obsidian computed style、DOM bounds和截图；dashboard-main直接子级 | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-01 | 真实Obsidian边界矩阵，现有layout/scroll探针 | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-01 | 真实宿主横幅bounds及键盘操作 | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-02 | home parser/sync与BoardOperations面板，restart | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-02 | test/golden/user-formats.test.ts和生产codec/write adapter | covered | 每条必须有真实Evidence；无deferred |
| AC-006 | T-02 | NOTICE、docs/third-party/apex-dashboard.md/.ZH.md、check:notices | covered | 每条必须有真实Evidence；无deferred |
| AC-007 | T-02 | core migration函数、parser golden、platform/board/sync | covered | 每条必须有真实Evidence；无deferred |
| AC-008 | T-03 | ModuleContext.contributions collect/watch与WidgetHost | covered | 每条必须有真实Evidence；无deferred |
| AC-009 | T-03 | board YAML、provider实例存储与两板实际UI | covered | 每条必须有真实Evidence；无deferred |
| AC-010 | T-03 | 真实模块开关、registry lifetime与persisted members | covered | 每条必须有真实Evidence；无deferred |
| AC-011 | T-03 | 挂载cleanup协议及真实home生命周期 | covered | 每条必须有真实Evidence；无deferred |
| AC-012 | T-04 | 真实页面+tile codec和纯layout函数 | covered | 每条必须有真实Evidence；无deferred |
| AC-013 | T-04 | 新增core immersive测试，先例test/golden/user-formats.test.ts | covered | 每条必须有真实Evidence；无deferred |
| AC-014 | T-04 | owner-window ResizeObserver与实际持久化差异 | covered | 每条必须有真实Evidence；无deferred |
| AC-015 | T-04 | codec/migration诊断及vault写日志 | covered | 每条必须有真实Evidence；无deferred |
| AC-016 | T-05 | 真实Obsidian pointer手势与纯placement authority | covered | 每条必须有真实Evidence；无deferred |
| AC-017 | T-05 | 真实键盘/pointercancel与sync写次数 | covered | 每条必须有真实Evidence；无deferred |
| AC-018 | T-05 | 真实键盘与aria-live DOM | covered | 每条必须有真实Evidence；无deferred |
| AC-019 | T-05 | 真实长板手势和owner window调度 | covered | 每条必须有真实Evidence；无deferred |
| AC-020 | T-05 | matchMedia reduce、真实popout、styles检查 | covered | 每条必须有真实Evidence；无deferred |
| AC-021 | T-06 | widget catalog/create配置入口及provider store | covered | 每条必须有真实Evidence；无deferred |
| AC-022 | T-06 | home/workbench-panel与BoardRegistry | covered | 每条必须有真实Evidence；无deferred |
| AC-023 | T-06 | 真实widget菜单/按钮及YAML | covered | 每条必须有真实Evidence；无deferred |
| AC-024 | T-07 | shared buildAgentPrompt纯函数，新增co-located测试 | covered | 每条必须有真实Evidence；无deferred |
| AC-025 | T-07 | Preact prompt dialog、AGENT_DISPATCH调用记录 | covered | 每条必须有真实Evidence；无deferred |
| AC-026 | T-07 | AGENT_DISPATCH、automations invocation、AgentRuntimePort | covered | 每条必须有真实Evidence；无deferred |
| AC-027 | T-07 | 按钮模型、public invocation去重与run journal | covered | 每条必须有真实Evidence；无deferred |
| AC-028 | T-07 | service availability/readiness与真实或受控runtime | covered | 每条必须有真实Evidence；无deferred |
| AC-029 | T-07 | module lifetime和abort契约 | covered | 每条必须有真实Evidence；无deferred |
| AC-030 | T-07 | production board codec + architecture gate | covered | 每条必须有真实Evidence；无deferred |
| AC-031 | T-08 | sessionMaterialPort、terminal paste字节观察，先例session.test.ts | covered | 每条必须有真实Evidence；无deferred |
| AC-032 | T-08 | AgentSessionSummary/dispatch destination校验 | covered | 每条必须有真实Evidence；无deferred |
| AC-033 | T-08 | QuickNotesPanel/CardPanel与context builder | covered | 每条必须有真实Evidence；无deferred |
| AC-034 | T-08 | stage context builder + dialog/dispatch finalPrompt | covered | 每条必须有真实Evidence；无deferred |
| AC-035 | T-08 | automation receipt模型和用户界面 | covered | 每条必须有真实Evidence；无deferred |
| AC-036 | T-09 | vault skill adapter与生产DataAdapter契约fixture | covered | 每条必须有真实Evidence；无deferred |
| AC-037 | T-09 | agent settings knownSkills及picker | covered | 每条必须有真实Evidence；无deferred |
| AC-038 | T-09 | platform/desktop adapter、device settings与architecture | covered | 每条必须有真实Evidence；无deferred |
| AC-039 | T-09 | agent capability表、官方文档引用及实际目标smoke | covered | 每条必须有真实Evidence；无deferred |
| AC-040 | T-10 | PipelineConfig codec、platform scanner、PipelineSection | covered | 每条必须有真实Evidence；无deferred |
| AC-041 | T-10 | temporary real vault文件/status/link与fileManager | covered | 每条必须有真实Evidence；无deferred |
| AC-042 | T-10 | pipeline IO前置校验、生产safe writer | covered | 每条必须有真实Evidence；无deferred |
| AC-043 | T-10 | injected IO failure + visible error / reread | covered | 每条必须有真实Evidence；无deferred |
| AC-044 | T-10 | workflow配置与真实列UI | covered | 每条必须有真实Evidence；无deferred |
| AC-045 | T-10 | pipeline task writer + home automation-source + fixed clock | covered | 每条必须有真实Evidence；无deferred |
| AC-046 | T-10 | pipeline context纯函数及AGENT_DISPATCH边界 | covered | 每条必须有真实Evidence；无deferred |
| AC-047 | T-10 | pipeline archive IO与真实文件状态 | covered | 每条必须有真实Evidence；无deferred |
| AC-048 | T-11 | parse projection + old golden | covered | 每条必须有真实Evidence；无deferred |
| AC-049 | T-11 | existing library-new-note/production note creator | covered | 每条必须有真实Evidence；无deferred |
| AC-050 | T-11 | vault IO log与new-format golden | covered | 每条必须有真实Evidence；无deferred |
| AC-051 | T-12 | LibraryViews table model + parser golden | covered | 每条必须有真实Evidence；无deferred |
| AC-052 | T-12 | table candidate/order纯函数 | covered | 每条必须有真实Evidence；无deferred |
| AC-053 | T-12 | TableColumns Preact UI与host键盘 | covered | 每条必须有真实Evidence；无deferred |
| AC-054 | T-13 | LibraryPanel/LibraryKanban真实DOM | covered | 每条必须有真实Evidence；无deferred |
| AC-055 | T-13 | progressive model + 501项代表性fixture | covered | 每条必须有真实Evidence；无deferred |
| AC-056 | T-13 | 真实大库代表场景和DOM节点观察 | covered | 每条必须有真实Evidence；无deferred |
| AC-057 | T-14 | calendar converter/AnniversaryConfig golden | covered | 每条必须有真实Evidence；无deferred |
| AC-058 | T-14 | pure annual mapper已知日期案例与设置帮助 | covered | 每条必须有真实Evidence；无deferred |
| AC-059 | T-14 | calendar mapper + automation anniversary scheduling固定时钟 | covered | 每条必须有真实Evidence；无deferred |
| AC-060 | T-14 | anniversary widget/source与bundle/architecture | covered | 每条必须有真实Evidence；无deferred |
| AC-061 | T-15 | banner/cards真实渲染 + codec | covered | 每条必须有真实Evidence；无deferred |
| AC-062 | T-15 | FocalPointPanel UI与纯坐标函数 | covered | 每条必须有真实Evidence；无deferred |
| AC-063 | T-15 | parser-preserve golden和image mapping | covered | 每条必须有真实Evidence；无deferred |
| AC-064 | T-16 | home appearancePresets + two SettingsHandle updates/flush | covered | 每条必须有真实Evidence；无deferred |
| AC-065 | T-16 | ThemeRuntime、home refreshAppearanceLive、restart | covered | 每条必须有真实Evidence；无deferred |
| AC-066 | T-16 | preset model及真实UI | covered | 每条必须有真实Evidence；无deferred |
| AC-067 | T-16 | SettingsStore状态与appearance service | covered | 每条必须有真实Evidence；无deferred |
| AC-068 | T-17 | getIconIds host wrapper、IconPickerModal | covered | 每条必须有真实Evidence；无deferred |
| AC-069 | T-17 | bundle input report与picker DOM count | covered | 每条必须有真实Evidence；无deferred |
| AC-070 | T-17 | LibraryViews/Kanban + trashLibraryFile | covered | 每条必须有真实Evidence；无deferred |
| AC-071 | T-17 | existing trash path与真实临时vault | covered | 每条必须有真实Evidence；无deferred |
| AC-072 | T-18 | 真实Obsidian跨change集成 | covered | 每条必须有真实Evidence；无deferred |
| AC-073 | T-18 | 已有package scripts，保存命令输出 | covered | 每条必须有真实Evidence；无deferred |
| AC-074 | T-18 | style gates、真实light/dark三preset截图 | covered | 每条必须有真实Evidence；无deferred |
| AC-075 | T-18 | 已有real-Obsidian acceptance流程 | covered | 每条必须有真实Evidence；无deferred |
| AC-076 | T-18 | check:notices、test:docs、check-similarity --theirs 临时树 | covered | 每条必须有真实Evidence；无deferred |
| AC-077 | T-18 | 最终验收清单与工件真实源回读 | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- 上游注释与实现不一致（坐标持久化、readonly预览、stage直发），按固定源码事实和用户确认修正，不盲搬注释。
- 迁移混合raw/source/baseline可能让首次打开改写；以旧字节golden和读盘写次数验证，继续使用现有preserveDocument。
- provider关闭被normalize当孤儿导致布局丢失；persisted member集合与active contribution集合明确分开。
- 自动化reuse会回车，与快捷按钮既有会话语义冲突；独立路由到attachMaterial并检测实际输入字节。
- workflow状态成功而rename失败会产生部分结果；提前检测目标冲突，错误回读真实状态，不只回滚DOM、不隐藏失败。
- cap粗/细单位反复迁移和窄屏坐标覆盖；codec只迁移legacy h一次，effective布局不写canonical。
- 主题组合跨namespace持久化：使用已有SettingsStore合并flush并明确保存错误，避免新增事务系统或私有主题。
- 18票有真实写文件重叠及跨change公共接口；严格串行由总体计划安排，deps只表示语义前置，不用伪依赖掩盖冲突。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
