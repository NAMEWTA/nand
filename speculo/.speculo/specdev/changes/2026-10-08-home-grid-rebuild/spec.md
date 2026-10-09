---
schema_version: 3
artifact: "spec"
change: "2026-10-08-home-grid-rebuild"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

# Spec: 首页看板自由网格、组件贡献与智能体技能派发

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

先独立修复 #141 的窄桌面快捷创建栏异常高度和横幅遮挡；随后完整落实 #137：固定参考 apex-dashboard 3.7.5 源码，形成按看板布局/成员、沉浸式统一网格、内外部小组件贡献、NAND 终端技能派发、工作流分区以及全部八项附加体验。遵守现有模块边界、懒加载、全局主题、Markdown 保真、i18n 与许可；RSS 产品由新闻 change 实现。本次交付是成熟规格、18 张票与串行计划，不执行实现或发布。

### 当前事实

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### 目标用户与场景

- 作为窄桌面窗口用户，我打开首页即能看到紧凑快捷创建栏及其下方内容，不会误以为加载失败。
- 作为多看板用户，我能为工作与生活分别选布局、增减组件、自由排列并在重启后恢复，旧笔记不会仅因打开就被改写。
- 作为键盘或读屏用户，我能完成全部网格移动、缩放、取消与布局配置，并知道当前结果。
- 作为模块使用者，我能把新闻、自动化与技能组件添加到同一看板，暂时关闭模块后仍保留布局。
- 作为终端 agent 用户，我能从技能组件、快念或卡片生成准确上下文 prompt，预览编辑后启动新会话或粘贴到既有会话。
- 作为笔记工作流用户，我能推进阶段、维护截止日期/清单和文件归档，并对整列或选中笔记派发技能。
- 作为大库和长期使用者，我能使用模板、列配置、渐进列表、农历提醒、图片焦点、组合外观与全量图标，得到可追溯且不丢数据的升级。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约
- Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项
- GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS
- dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统
- 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成
- 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布

## 2. 解决方案与外部行为

首页先交付 #141 的局部修复：quicknote 位于 dashboard-main 的 column 直接子级时，其 flex-basis 必须由实际内容决定；不能用固定高度遮盖 capture 自动增高。639/640/641/660 的视口边界与大视口内窄 pane 分开验证，避免把桌面误当手机。横幅工作区计数与新增按钮留出位置，不覆盖引言。

看板打开先读取原 Markdown 和旧设置，构造只读有效模型，再渲染所选布局。没有 per-board layout 时优先使用合法历史 layoutMode，否则保持当前 stacked；Phone 仅把有效布局改为 side。用户通过面板菜单或新建入口选布局；切入 immersive 时才从实际旧 widget/section 尺寸生成 canonical tile 数据，保存一次。退出 immersive 保留其坐标，返回恢复。看板排序使用已有 BoardOperations；资源状态保存原 boardPath，不新增 leaf。

HOME_WIDGETS 由模块在贡献列表中声明，home watch 可用性并按 member 引用挂载。先列可添加类型/实例，已有单实例在本板禁用重复添加；没有相册、倒计时、纪念日实例时提供“新建…”，配置成功才创建成员，取消无写入。内置和外部同一路径，renderer 不再保留另一份 hardcoded enabled 列表。移除仅删除本板 member/placement，不删提供方配置；模块关闭先 dispose 对应挂载，再显示“在设置中开启”占位，不清除成员。重新开启按原尺寸/位置挂载一次。渲染失败局限本组件并显示真实错误，不阻断其他模块。

沉浸网格以 12 列、10px 行、10px 间距为 canonical 几何；纯算法只读输入并返回确定性布局，不使用 DOM/Obsidian。自动 tile 由 skyline 摆放，有显式 x/y 的 tile 保留自由落点；普通 tile 内容贴合至 cap，用户缩放设置 fixed 精确尺寸。以board内容容器宽度取有效列数：≥960px为12列、600–959px为6列、<600px为3列；Phone仍优先side。缩减列数时按canonical顺序确定性重排，宽度钳制到有效列数，保留原x/y/w/cap。仅resize/reflow不写；窄屏用户编辑也必须通过同一canonical变更与有效布局投影生成预览，提交后显示位置与预览一致，不能把纯显示坐标冒充canonical整体覆写。布局/预览/落点共用同一算法和有效列数，不复制上游固定 12 列的窄屏冲突缺陷。未知或禁用 provider 的位置作为保留成员，不能被 normalize 的 orphan sweep 删除。

pointer 从可见标题/握柄超过阈值后进入 moving；控件、链接、编辑区不触发。显示落点幽灵，8px 邻边吸附；主要重叠交换两个 tile 起点并验证新占用，其他碰撞找最近空位。边缘自动滚动持续至离开边缘/完成/取消，不能只依赖 pointermove。拖拽/缩放是 preview → commit 或 cancel：Esc、pointercancel、面板卸载恢复手势起点和焦点，零持久化；一次放下产生一次语义写入。边/角缩放遵守组件最小值，放下后重排不重叠。键盘焦点 tile 可 Enter/Space 拾取/放下，方向键移动，Shift+方向键缩放，Esc 恢复，并用 polite live region 报位置/尺寸。动画仅 transform/opacity，reduced-motion 关闭过渡；数据更新和滚动仍工作。每个 surface 使用自己的 el.doc/el.win 与清理链，不共享全局 drag/window。

技能按钮共有一种声明模型，入口可来自组件、快念、普通卡片、工作流列头/卡片。调用方提供 path/title/stage/folder/paths/input 等上下文，纯 buildAgentPrompt 单次替换原模板，值里的花括号保持字面量；未知变量保留可见而非吞掉。校验技能名，Claude Code 用 /，Codex 用 $；其余 agent 先根据官方当前文档记录能力后映射，不盲猜通用前缀。默认预览展示可编辑最终 prompt、补充输入、目标/会话和文件范围；最终编辑不会在点击发送时被旧模板重算覆盖。确认后立即关闭，后台状态通过现有记录/通知回报，重复提交被同一 invocation 去重。directSend 是明确的每按钮设置；列头默认预览，显式直发精确展开当前整列适用文件，空列显示空范围，不扩大到全库。

派发通过 agent/api.ts 公开端口。新会话经现有 runtime.start 并进入自动化运行记录，已有会话经 AGENT_SESSIONS.attachMaterial 粘贴一个未发送块，不注入 Enter、shell 拼接或模拟额外按键。日志先区分 accepted/starting/pasted/failed/timeout 与长期执行状态；pasted 只意味材料送达输入框，不伪称 agent 已完成。新 runtime 的真实 completion 保持 succeeded/failed/cancelled/interrupted/unknown 语义。10s 是交付/readiness 等待上限，不能将超时误称底层任务停止；取消/禁用释放自有 timers/listeners，错误按 missing/unsupported/chat/busy 加本地化上下文。agent 模块关闭时入口占位，不自动启用、不偷偷启动进程。共享派发、技能目录与运行回执契约由本 change 拥有，news/browser 复用。

技能发现仅在选择器/显式刷新时读取约定库目录 .agents/skills、.claude/skills、.codex/skills 与已保存名字；读取有效 SKILL.md frontmatter 的 name，缺省目录名，去重并标来源。DataAdapter 返回完整 vault-relative path 时直接使用，不重复拼 base。用户额外目录是显式配置的 device 字段，只有 platform/desktop 处理 Node、~ 和主目录；空配置零库外扫描。没有支持技能调用语法的目标仍能用无技能名的普通 prompt，不伪造技能可用。

workflow 是 home 自己的 sectionType：用户设置 root、statusField、stages、exclude、模板、可选 stage folder/archive folder。只有范围内且状态匹配的 Markdown 出现；列头宽度/排序/筛选可持久化，默认阶段语义中立，无上游个人文件夹。阶段移动先检查路径/名称冲突，读取最新 frontmatter 再写状态，配置了目录才 renameFile 以维护链接。真正 IO 错误不靠 DOM 回滚伪造成功：显示实际已完成子步骤、重读磁盘，显式重试只补未完成动作，不引入通用事务/后台重试体系。清单切换基于最新原文定位原任务；截止/提醒接现有 automation-source 与通知，不能建新提醒轮询器。每阶段/card 技能获得对应变量；目录变化后 path 用当前真实文件。

附加体验逐项落地：多模板 0=空白、1=直接使用、多个=选择后创建，取消不创建；旧 templatePath 只读投影为列表。每分区 tableOrder/tableHidden 独立，暂时消失字段保留偏好，新字段追加可见，可键盘排序。分组/kanban 初始每组最多50，更多追加50，结果总数仍显示完整数据；每 section 共用500条渲染候选上限，排序/过滤后截断并明确提示用户缩小条件，不能把截断当数据删除。农历纪念日保存真实阳历起点与 calendar，双向输入保持同一天；闰月缺失用同名普通月、短月取末日，提醒使用同一转换。

封面和每张轮播图分别存0..100焦点，pointer 与键盘/数值编辑一致，重置中心不动原图路径。命名组合外观保存 theme 所有既有字段和 home 装饰字段，通过两个设置 handle 更新并共同 flush；两个 namespace 保留各自所有权，全部窗口收到现有运行时更新，失败显示设置保存错误，不虚报已保存。删除当前快照只删命名记录，当前外观保留。图标选全部宿主可渲染名称，常用先、模糊搜、界面至多400行，复用 Iconic 关键词只能走公开服务或共同 host 层；关闭 icons 不影响基本全量选择。library/folder grid/gallery/kanban 上的删除在 hover/focus/touch 可达，走现有 trash/确认策略，阻断卡片打开/拖拽冒泡。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为窄桌面窗口用户，我打开首页即能看到紧凑快捷创建栏及其下方内容，不会误以为加载失败。
- **US-002**：作为多看板用户，我能为工作与生活分别选布局、增减组件、自由排列并在重启后恢复，旧笔记不会仅因打开就被改写。
- **US-003**：作为键盘或读屏用户，我能完成全部网格移动、缩放、取消与布局配置，并知道当前结果。
- **US-004**：作为模块使用者，我能把新闻、自动化与技能组件添加到同一看板，暂时关闭模块后仍保留布局。
- **US-005**：作为终端 agent 用户，我能从技能组件、快念或卡片生成准确上下文 prompt，预览编辑后启动新会话或粘贴到既有会话。
- **US-006**：作为笔记工作流用户，我能推进阶段、维护截止日期/清单和文件归档，并对整列或选中笔记派发技能。
- **US-007**：作为大库和长期使用者，我能使用模板、列配置、渐进列表、农历提醒、图片焦点、组合外观与全量图标，得到可追溯且不丢数据的升级。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 桌面640×740、文件栏展开、首页有效宽约288px | 打开首页、切别页再返回，分别使用en/zh | quicknote为内容自然高度，下方周历/最近编辑/分区紧接可见，无约1950px空框 | 真实Obsidian computed style、DOM bounds和截图；dashboard-main直接子级 |
| AC-002 | 639/640/641/660视口及宽视口的窄pane，empty/populated/capture展开状态 | 调尺寸并输入多行capture | 无flex-basis高度跳变，capture按内容增高，正常宽度和实际phone side保持可用 | 真实Obsidian边界矩阵，现有layout/scroll探针 |
| AC-003 | 同#141窄窗口横幅 | 查看计数、+和首行引言，键盘导航 | 按钮/徽标不覆盖文字，焦点和点击目标可用 | 真实宿主横幅bounds及键盘操作 |
| AC-004 | 多个旧看板与历史layoutMode可用/缺失/无效 | 只读打开再为其中一板选择side或stacked、重启 | 旧板初始兼容，选择只写当前板，其他板与原始选择不变 | home parser/sync与BoardOperations面板，restart |
| AC-005 | 原始Markdown含未知frontmatter、注释、空白、未编辑卡片及旧grid字段 | parse→serialize且仅打开页面 | 输出逐字节相同、无vault写入；新增功能不重建全文 | test/golden/user-formats.test.ts和生产codec/write adapter |
| AC-006 | apex固定SHA首次适配文件进入实现 | 检查来源、版权、NOTICE和双语文件映射 | 每个适配文件可追到SHA/原文件，MIT完整保留，未误用package的0-BSD；GPL无代码迁移 | NOTICE、docs/third-party/apex-dashboard.md/.ZH.md、check:notices |
| AC-007 | 用户首次切immersive，旧global enables/order/family/ratios存在 | 生成投影并提交布局；再次重启 | 保留实际旧顺序，坐标只首切生成；layoutMode只作为历史输入，转换不重复或丢配置 | core migration函数、parser golden、platform/board/sync |
| AC-008 | 所有现有内置widget与一个外部provider贡献 | 分别打开side/stacked，添加移除成员 | 内置外部走同一HOME_WIDGETS挂载路径，无并行hardcoded renderer，两个看板成员独立 | ModuleContext.contributions collect/watch与WidgetHost |
| AC-009 | 同一widget实例被两个看板引用 | 在一板移除成员 | 仅该板成员/placement移除，实例配置与另一板保留 | board YAML、provider实例存储与两板实际UI |
| AC-010 | 已布局的外部widget对应模块可禁用 | 关闭再开启provider | 原位占位可引导设置；成员位置未写丢，重新开启挂载一次，释放旧listeners/timers | 真实模块开关、registry lifetime与persisted members |
| AC-011 | 组件render失败或页面卸载 | 触发错误/关闭页/关闭home | 只该widget错误，其他组件继续；dispose幂等且不删除数据，无遗留进程/observer | 挂载cleanup协议及真实home生命周期 |
| AC-012 | 包含widgets、sections、standalone cards的immersive板 | 选择immersive并调整尺寸后重启 | 统一12列网格，10px行/间距，单一tile尺寸/坐标恢复；不存在未接入grid回调 | 真实页面+tile codec和纯layout函数 |
| AC-013 | 自动/explicit/fixed/cap/legacy h混合输入 | 计算布局与两次parse保存 | 合法输入确定性、不重叠，legacy h仅迁移一次；内容fit不超过cap，fixed不缩回 | 新增core immersive测试，先例test/golden/user-formats.test.ts |
| AC-014 | canonical12列布局，窄pane或phone | 依次缩到有效6/3列，再扩回桌面，phone打开 | 窄显示不越界；phone有效side；存盘canonical未被自动reflow覆盖，回桌面恢复 | owner-window ResizeObserver与实际持久化差异 |
| AC-015 | 异常tile字段/被禁用provider/无效旧配置 | 打开、显示提示、不编辑离开 | 可用安全默认布局，不损坏源，未知成员/原坐标保留；有效卡片正常显示 | codec/migration诊断及vault写日志 |
| AC-016 | 有相邻不等尺寸tile且标题内含button/input | pointer移动、吸附、主要重叠交换、边/角缩放 | 幽灵与最终落点一致，8px吸附与min尺寸生效，commit后不重叠；控件不误拖 | 真实Obsidian pointer手势与纯placement authority |
| AC-017 | 正在移动/缩放，板有已保存布局 | 分别Esc、pointercancel、关闭页面 | 恢复手势起点和焦点，零布局写入，ghost/capture/timer全部结束 | 真实键盘/pointercancel与sync写次数 |
| AC-018 | tile获得键盘焦点 | Enter/Space、Arrow、Shift+Arrow、Esc组合 | 完全键盘可移动缩放提交取消，读屏播报位置/尺寸，焦点保持可见 | 真实键盘与aria-live DOM |
| AC-019 | 长网格且指针停在滚动区域边缘 | 拖到边缘保持静止再放下 | 自动滚动持续，落点随滚动准确；释放即停止，不泄漏rAF | 真实长板手势和owner window调度 |
| AC-020 | reduced-motion与popout窗口同时存在 | 执行grid移动/resize并关闭popout | 只有允许的transform/opacity可动画；reduce无过渡，功能仍工作；各窗口状态与清理独立 | matchMedia reduce、真实popout、styles检查 |
| AC-021 | 相册/倒计时/纪念日均无实例 | 添加菜单新建，分别确认/取消 | 确认就地创建并自动落卡；取消不创建配置/成员；已有成员不可重复单实例添加 | widget catalog/create配置入口及provider store |
| AC-022 | 多个看板与多实例组件 | 通过面板/菜单排序并调整组件成员顺序 | BoardOperations.reorder被复用，重启保持两种顺序，各板选择正确 | home/workbench-panel与BoardRegistry |
| AC-023 | immersive widget有底层配置 | 右键移除或×，再重新添加 | 两种入口只改membership，重新添加可选原实例；鼠标/键盘/touch可达 | 真实widget菜单/按钮及YAML |
| AC-024 | skillName与模板含所有受支持变量，值内含花括号 | 生成不同agent的prompt | Claude Code /、Codex $；单次原模板替换，值不二次展开，未知变量保留，非法技能名明确拒绝 | shared buildAgentPrompt纯函数，新增co-located测试 |
| AC-025 | skills widget配置fresh目标且默认预览 | 补充input/选files/编辑最终prompt后确认 | 真正可编辑的最终文本原样提交一次，确认立即关窗，状态由通知/记录反馈 | Preact prompt dialog、AGENT_DISPATCH调用记录 |
| AC-026 | 有效agent与手动来源 | 从fresh技能发送 | 经agent公开端口到现有runtime.start，先有运行记录，正确关联source/run/terminal，真实完成状态由runtime报告 | AGENT_DISPATCH、automations invocation、AgentRuntimePort |
| AC-027 | 同一按钮显式directSend或重复快速点击 | 发送无需预览的fresh技能 | 直发按本按钮配置；同invocation只启动一次，最终prompt快照可查 | 按钮模型、public invocation去重与run journal |
| AC-028 | agent关闭、不支持、忙、未就绪或交付等待超时 | 点击技能发送/等待超过10秒 | 有本地化missing/unsupported/chat/busy/timeout反馈，模块关闭占位且不自动启用；超时不谎称取消任务 | service availability/readiness与真实或受控runtime |
| AC-029 | 打开技能弹窗或交付等待中 | 关闭home/agent或page | 释放自有定时器/监听/lease，不遗留弹窗；既已启动任务按现有owner政策处理，状态真实 | module lifetime和abort契约 |
| AC-030 | 板有skills/prompt/directSend/session配置且混有旧数据 | 保存/重启/改其中一字段 | 新字段有golden并正确恢复，旧字段与无关原文不变，home不导入agent私有代码 | production board codec + architecture gate |
| AC-031 | 已有interactive agent session就绪 | 从快捷按钮选择该session并发送 | AGENT_SESSIONS.attachMaterial接一次未发送块，实际输入中没有自动Enter | sessionMaterialPort、terminal paste字节观察，先例session.test.ts |
| AC-032 | 保存的existing session失效或目标agent不匹配 | 点击该技能 | 要求重新选择/显示不可用，不静默启动fresh或发到错误会话 | AgentSessionSummary/dispatch destination校验 |
| AC-033 | quicknote和普通card都配置同一技能 | 分别触发并预览 | path/title/input来自触发点，card移动/重命名后用当前路径；共享同一派发实现 | QuickNotesPanel/CardPanel与context builder |
| AC-034 | 工作流列头有多张适用笔记 | 默认预览选子集，再启用该按钮directSend | 预览可选子集；显式直发展开整列paths；空列不扩展全库、不沿用旧选区 | stage context builder + dialog/dispatch finalPrompt |
| AC-035 | existing会话材料已粘贴但未发送给CLI | 查看运行记录和通知 | 回执显示已粘贴/待用户发送，绝不显示模型任务succeeded；fresh运行仍跟踪真实completion | automation receipt模型和用户界面 |
| AC-036 | 库内三个skills目录有SKILL.md、重名及正文name字段 | 打开技能picker | 仅frontmatter name或目录fallback成为名称，去重保留来源；DataAdapter path无重复base | vault skill adapter与生产DataAdapter契约fixture |
| AC-037 | 某agent保存有效技能名，目录以后移走 | 再次配置该agent按钮 | 记住已保存名字并标remembered；其他agent隔离，放弃的输入不污染目录 | agent settings knownSkills及picker |
| AC-038 | 额外桌面目录未配置/配置含~；实际mobile | 刷新技能列表 | 空配置不读库外；配置仅desktop展开home读取；mobile显示库内/remembered，不执行Node | platform/desktop adapter、device settings与architecture |
| AC-039 | 六种NAND CLI能力需使用技能按钮 | 为每target核查官方文档并实现映射 | 交付映射有文档URL/日期，支持则正确调用；无证据不猜prefix，不支持仍可普通prompt | agent capability表、官方文档引用及实际目标smoke |
| AC-040 | 用户新建workflow分区 | 配置root/status/stages/excludes/template并打开 | 只匹配范围和状态的笔记入列，默认无个人目录，配置可重启恢复 | PipelineConfig codec、platform scanner、PipelineSection |
| AC-041 | 笔记有有效目标stage且可选folder配置 | 拖入/键盘菜单推进阶段 | 写最新frontmatter status；仅配置folder时renameFile，内部链接随宿主策略更新，UI和盘一致 | temporary real vault文件/status/link与fileManager |
| AC-042 | 目标存在同名文件或路径越界 | 尝试推进或归档 | 在变更前拒绝，原文件/状态不被损坏，不覆盖目标 | pipeline IO前置校验、生产safe writer |
| AC-043 | 状态写成功但rename失败 | 执行推进并查看结果 | 错误明确指出部分结果，回读真实磁盘，既不假装成功也不只回滚DOM；显式重试不重复已完成动作 | injected IO failure + visible error / reread |
| AC-044 | 列有过滤字段/排序/宽度设置 | 过滤排序、resize列、重启 | 数据排序与counts正确、宽度恢复，键盘也可调整；大列表策略同home既有规模合同 | workflow配置与真实列UI |
| AC-045 | 工作流卡片有checkbox任务和截止/remind | 切换任务、改due、到提醒时点 | 最新原文的目标任务改变，其余文本保留；截止与通知复用automation source，不额外轮询 | pipeline task writer + home automation-source + fixed clock |
| AC-046 | 阶段/卡片技能均配置 | 先移动文件再分别派发 | path/title/stage/folder及paths都对应实际当前位置/集合，scope互不混淆 | pipeline context纯函数及AGENT_DISPATCH边界 |
| AC-047 | 当前workflow笔记配置archiveFolder | 显式归档并重新加载 | 仅按用户配置写archived状态/移动，冲突可见、无作者个人目录；卡片移出活动阶段 | pipeline archive IO与真实文件状态 |
| AC-048 | 旧library/folder只有templatePath | 打开配置但不编辑 | 读为单模板而文件逐字节不变 | parse projection + old golden |
| AC-049 | 模板列表0/1/多项 | 新建笔记并选择其一 | 0空白、1直接、多项选中后使用该模板，沿用title/date替换、filter prefill与唯一文件名 | existing library-new-note/production note creator |
| AC-050 | 多模板选择菜单/配置尚未确认 | 取消后检查vault，再保存列表重启 | 取消零新文件；确认列表按顺序恢复且旧单字段兼容窗口明确 | vault IO log与new-format golden |
| AC-051 | 两个分区表格字段不同 | 一板分区内隐藏/重排列并重启 | 只影响当前分区，显隐/顺序恢复，内容值不改 | LibraryViews table model + parser golden |
| AC-052 | 已设置偏好的字段暂时无数据，新字段出现 | 重扫表格再恢复原字段 | 缺席字段偏好保留，新字段追加可见，原字段返回仍按原order/hidden | table candidate/order纯函数 |
| AC-053 | 表格列配置界面 | 仅键盘隐藏/移动/重置 | 可见焦点及原生控件完成操作，重置恢复派生默认列 | TableColumns Preact UI与host键盘 |
| AC-054 | 分组/kanban每组有超过100项 | 打开后连续Show more | 初始至多50/组，每次增加50，现有卡片节点/焦点保留，counts显示数据总数 | LibraryPanel/LibraryKanban真实DOM |
| AC-055 | 过滤排序后section结果超过500 | 打开分组/kanban、缩小筛选 | section最多500候选进入各组，明确截断及完整总数；缩小后可看到原本被截断结果，未改源数据 | progressive model + 501项代表性fixture |
| AC-056 | 渐进列表有拖拽/删除/刷新 | 加载更多后操作卡片 | drag wiring、删除、counts与loaded限额一致，不重建全部卡片或冻结窗口 | 真实大库代表场景和DOM节点观察 |
| AC-057 | 阳历/农历日期包含真实闰月起点 | 反复切换输入模式并保存重启 | startDate始终同一真实阳历日，calendar和精度保持，旧无calendar按solar | calendar converter/AnniversaryConfig golden |
| AC-058 | 起点闰月在目标年不存在 | 计算并显示本年周年 | 采用同名普通农历月，提示政策，不回退公历月日 | pure annual mapper已知日期案例与设置帮助 |
| AC-059 | 原农历30日在目标月仅29天 | 计算本年周年及下一次提醒 | 取目标农历月末，通知用同一日期规则，不出现无效日期 | calendar mapper + automation anniversary scheduling固定时钟 |
| AC-060 | 普通solar周年及新的lunar周年并存 | 编辑/查看/触发提醒 | 旧solar行为保持，lunar展示和运行记录一致；复用lazy lunar，不从core导入UI | anniversary widget/source与bundle/architecture |
| AC-061 | banner轮播至少2图和card cover | 分别调整焦点、保存、切图、重启 | 每图/cover独立0..100焦点恢复，实际crop匹配预览 | banner/cards真实渲染 + codec |
| AC-062 | 焦点编辑器获焦点 | 用pointer、键盘/数值及reset | 两种输入得到同一焦点，reset中心，尺寸变化不丢值，可访问性达标 | FocalPointPanel UI与纯坐标函数 |
| AC-063 | 旧图片无focal或手改越界/无效坐标 | 只读打开再有意编辑该图 | 旧center显示不变，非法显示被归一化但不自动写源；编辑只更新相关图 | parser-preserve golden和image mapping |
| AC-064 | 全局theme与home外观都自定义 | 保存命名组合、改变外观再应用 | 既有theme全部字段和home允许字段共同恢复，未包含看板路径/凭证/设备设置 | home appearancePresets + two SettingsHandle updates/flush |
| AC-065 | 主窗口与popout/多个看板 | 应用组合并重启 | 全局theme更新编辑器与全部窗口，home装饰更新全部看板，无per-board palette | ThemeRuntime、home refreshAppearanceLive、restart |
| AC-066 | 已存在同名/当前激活快照 | 尝试重名保存，再删除当前快照 | 重名反馈不覆盖；删除只删快照/active标记，当前外观不改变 | preset model及真实UI |
| AC-067 | 组合应用时持久化失败 | 查看设置状态和重开界面 | 显示真实保存错误，不称成功；两个namespace仍由原store拥有，可正常显式重试，无新恢复系统 | SettingsStore状态与appearance service |
| AC-068 | 非精选但宿主可渲染图标且icons模块关闭 | 在home图标picker搜索选择 | 全量宿主名称可用，常用置前，模糊搜索结果匹配，icons关闭不影响基本选择 | getIconIds host wrapper、IconPickerModal |
| AC-069 | 图标全集/关键词较大 | 首次打开picker并搜 | 资源按需加载，最多400行，跨模块仅公开api，未复制巨型icon list | bundle input report与picker DOM count |
| AC-070 | library/folder grid/gallery/kanban卡片 | hover/focus/touch触发删除 | 各视图可达且命名的删除按钮调用现有trash/确认，不打开卡片不开始drag | LibraryViews/Kanban + trashLibraryFile |
| AC-071 | 删除取消/成功/IO失败 | 分别执行文件卡删除 | 取消保留文件；成功counts刷新；失败提示且不伪造消失，不永久删除 | existing trash path与真实临时vault |
| AC-072 | 所有feature完成集成，news提供HOME_WIDGETS | 启用/禁用news及agent，切换布局并重启 | 新闻/skills/automations同registry，关闭各模块保布局，完整用户旅程可用 | 真实Obsidian跨change集成 |
| AC-073 | 源码与产物完成 | 运行build、lint、test、architecture、bundle | 零lint警告、全部pnpm test通过，启动≤120KiB及home/总包预算不超，产物同步 | 已有package scripts，保存命令输出 |
| AC-074 | CSS/主题/UI完成 | 运行lint:css、test:styles、check:styles并查六种preset/mode | 无新增literal color/!important/:has/raw z-index违规，tokens与实际主题可用 | style gates、真实light/dark三preset截图 |
| AC-075 | 模块开关、三个宽度级别、phone、popout、reduced-motion | 完成一轮行为回归 | 键盘/焦点/触控布局正确，卸载无遗留；记录未验证平台，不以build代替UI证据 | 已有real-Obsidian acceptance流程 |
| AC-076 | 适配源码与docs完成 | 核对许可映射，运行notices/docs检查与GPL对照相似度 | MIT声明/映射完整，双语dashboard/workbench/agent/data/module指南同步；GPL对照只报路径/数值，无代码抄写 | check:notices、test:docs、check-similarity --theirs 临时树 |
| AC-077 | 全部18票已实现并验证后，且外部依赖完成 | 核对AC→ticket→证据和未完成项 | 无遗漏P5/bug，无伪造测试/平台/共识，无过度兜底或新测试框架；issue关闭/发布另经所属workflow授权 | 最终验收清单与工件真实源回读 |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- #141 布局缺陷及附带横幅遮挡修复
- 三种 per-board 布局与惰性保真迁移
- 12 列沉浸网格及完整 pointer/键盘/取消/响应式交互
- HOME_WIDGETS 注册、全内置迁移、多实例、模块关闭占位、看板排序
- 技能模板、发现、预览编辑、directSend、新会话/既有会话派发和共用记录
- 独立 workflow 分区：状态/目录推进、过滤排序、列宽、清单/截止提醒和技能
- 多模板、表格列显隐排序、大库渐进渲染、农历纪念日、封面横幅焦点、命名组合主题、全图标、悬停删除
- 许可映射、双语文档、按风险验证与模块/体积/移动端回归

### REUSE

- home BoardOperations、BoardRegistry 与现有 workspace 文件路径
- parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复
- ModuleContext contributions/services/lifetime 与 Preact shell page/panel
- AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务
- 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用
- theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统
- public Obsidian getIconIds、icons lazy keywords 经合法接口复用
- 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile
- 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针

### OUT

- **OOS-001**：RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约
- **OOS-002**：Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项
- **OOS-003**：GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS
- **OOS-004**：dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统
- **OOS-005**：按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成
- **OOS-006**：本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布

## 6. 已锁定实现约束

- **DEC-001**：使用 apex-dashboard @ db9d2892032c27f5f8899a72c0dca61d72572a9a，manifest 3.7.5；以 root MIT LICENSE 为准，保留 PandoraReads 版权、完整许可、源文件注释和双语映射。GPL home-pages @ 2f98a7c44432a5e077977535f94093487417c735 仅参考公开 README 行为，不读取/改写其实现源码。 来源：LOG-001；#137 明确要求；本轮 git/GitHub API 核查。。
- **DEC-002**：无新字段的存量看板保持当前可见布局；读取可投影历史 layoutMode 和 widgetOrder，但首次编辑前不写回。新建默认保持 stacked，用户可显式选择三种布局。canonical 网格不因窄屏或手机 reflow 改写。 来源：LOG-002；#137 惰性迁移/旧看板不变要求；当前 stacked 基线；本轮实现决策。。
- **DEC-003**：看板特有 layout/members/immersive/skills 存于该 Markdown YAML；实例配置由提供方现有命名空间/文档拥有。member 的 provider+kind+instanceId 保持稳定，禁用模块保留成员和位置，只显示可恢复占位。 来源：LOG-003；#137 小组件注册与按看板成员要求；ADR-0001/0003/0004；本轮实现决策。。
- **DEC-004**：新会话由 agent 公开派发端口最终进入 AgentRuntimePort.start 并复用自动化记录；已有 interactive 会话调用 AGENT_SESSIONS.attachMaterial 一次粘贴，不自动回车。所有入口共享本 change 所有的公共契约，news/browser 依赖它，不能另写平行派发层。 来源：LOG-004；#137 §三、用户/父任务本轮跨 change 所有权指示。。
- **DEC-005**：原始闰月在目标年不存在时映射同名普通农历月；目标月没有原日期时取该月月末。存储仍为原始阳历日期+calendar 标志，提示映射规则，绝不回退公历周年。 来源：LOG-005；用户本轮确认：农历闰月非闰年同名普通月，短月月末。。
- **DEC-006**：保存全局 theme + home 外观的组合快照；应用到所有看板、编辑器及弹出窗口，各字段仍由 theme/home 命名空间拥有。禁止按看板私有颜色/主题。 来源：LOG-006；用户本轮确认：保存全局 theme + home 组合；ADR-0006。。
- **DEC-007**：列头默认打开预览，用户可选择本次文件子集；每按钮可显式 directSend，直发时展开整列当前适用文件为完整 paths，不隐含沿用上次选区。空列不得默默扩大到全库。 来源：LOG-007；用户本轮确认：列头默认预览，可显式直发整列 paths。。
- **DEC-008**：#141 是 T-01 独立首修，不等待重构；后续执行严格串行，公共接口由本 change 拥有，最终集成序列由父 goal-plan 编排。本轮仅规划，P0-P6 的未来 PR 分组不等于授权当前发布。 来源：LOG-008；用户/父任务本轮确认及 #137 分阶段计划。。
- **DEC-009**：优先完成可用功能和规范结构；新增测试只锁定纯算法、格式、派发语义、真实错误路径等关键风险。复用现有 Vitest/golden/真实 Obsidian 探针，不建新测试平台、不添加广泛兜底或实现镜像断言。 来源：LOG-009；用户本轮明确要求；dev/testing。。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

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

## 8. 非功能要求

- **NFR-001**：架构：所有类型/值 import 满足 zones，api 仅类型/key，core/shared 无宿主，Node/Electron 仅 desktop；通过 pnpm test:architecture。
- **NFR-002**：懒加载：grid交互、pipeline、prompt UI、lunar与关键词 behind literal import；启动≤122880 bytes、home激活≤460800 bytes，遵守现有总包/style预算，不无理由提高上限。
- **NFR-003**：UI：Preact 在 shell 提供 root 内挂载并卸载；全字符串 en/zh t()；令牌颜色、原生控件、32px桌面/44px触控、可见焦点、读屏与reduced-motion。
- **NFR-004**：数据：只读打开/重排投影不写文件，编辑保留非托管原文，错误走现有 save-state/recovery；没有 saveData、localStorage 或第二份运行日志。
- **NFR-005**：性能：每手势/帧只计算一个布局快照，observer 合并重测；大列表50/500限制与更多操作，图标候选最多400 DOM行。
- **NFR-006**：生命周期：模块关闭、page切换/关闭、popout关闭释放所有订阅/计时器/observer/pointer捕获；一个widget失败不传播到其他模块。
- **NFR-007**：派发：最终prompt仅提交一次，既有会话零自动Enter；交付和执行完成分开记录；拒绝、不支持、忙、未就绪、超时均给准确本地化反馈。
- **NFR-008**：证据：真实Obsidian布局验证与构建/静态检查区分；Windows/macOS/移动端未跑的平台不得声称通过；不为功能建立过度兜底/测试架构。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-002, AC-003 | 真实Obsidian按#141步骤打开、切页返回、测量quicknote和下一块bounds; pnpm run test:layout-stacked && pnpm run test:scroll-root; node scripts/build-styles.mjs --write && pnpm run build && pnpm run lint && pnpm run lint:css && pnpm test:styles && pnpm run check:styles | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-004, AC-005, AC-006, AC-007 | pnpm exec vitest run test/golden/user-formats.test.ts; 真实宿主两板分别选side/stacked，重启并Phone有效布局检查; pnpm test && pnpm test:architecture && pnpm run check:notices && pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-02.md</Path> |
| T-03所列稳定入口 | 真实host/系统集成或定向单元 | AC-008, AC-009, AC-010, AC-011 | pnpm test; pnpm exec vitest run test/golden/user-formats.test.ts; 真实Obsidian两看板增删同一实例，关闭开启provider与home; pnpm test:architecture && pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-03.md</Path> |
| T-04所列稳定入口 | 真实host/系统集成或定向单元 | AC-012, AC-013, AC-014, AC-015 | pnpm test && pnpm exec vitest run test/golden/user-formats.test.ts; 真实Obsidian混合tile板切immersive，修改尺寸，重启；扩缩pane后回桌面; 手改无效tile字段并关闭provider后打开，不执行用户编辑; pnpm run build && pnpm test:architecture && pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-04.md</Path> |
| T-05所列稳定入口 | 真实host/系统集成或定向单元 | AC-016, AC-017, AC-018, AC-019, AC-020 | 真实Obsidian对不等尺寸tiles执行move/snap/swap/resize与边缘静止拖动; 真实Esc/pointercancel/关闭page操作并检查board写次数; 仅键盘执行完整move/resize/cancel，开启reduced-motion及popout; pnpm test && pnpm run lint && pnpm run lint:css && pnpm run check:styles | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> |
| T-06所列稳定入口 | 真实host/系统集成或定向单元 | AC-021, AC-022, AC-023 | 真实空配置库分别新建album/countdown/anniversary并重启; 真实两板共享实例，一板右键/×删除再添加; pnpm test && pnpm run test:album-widget | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-06.md</Path> |
| T-07所列稳定入口 | 真实host/系统集成或定向单元 | AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030 | pnpm test; pnpm exec vitest run test/golden/user-formats.test.ts; 真实Obsidian配置fresh技能，预览修改最终文本后发送/直发，查看终端和运行记录; 禁用agent、制造busy/readiness timeout、关闭page后观察; pnpm test:architecture && pnpm run check:bundle && pnpm run test:safety-regressions | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |
| T-08所列稳定入口 | 真实host/系统集成或定向单元 | AC-031, AC-032, AC-033, AC-034, AC-035 | pnpm test; 真实interactive session中由quicknote/card发送，再检查输入框与回执; 保存existing id后关闭会话，rename/move卡片文件再触发; pnpm run test:safety-regressions && pnpm test:architecture | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> |
| T-09所列稳定入口 | 真实host/系统集成或定向单元 | AC-036, AC-037, AC-038, AC-039 | pnpm test; 临时vault建立三个约定技能目录，保存一个name，配置/清空额外目录，再在mobile等价环境打开picker; pnpm test:architecture && pnpm run check:bundle && pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path> |
| T-10所列稳定入口 | 真实host/系统集成或定向单元 | AC-040, AC-041, AC-042, AC-043, AC-044, AC-045, AC-046, AC-047 | pnpm test && pnpm exec vitest run test/golden/user-formats.test.ts; 临时Obsidian vault配置两阶段，一列无folder、一列有folder，推进/键盘推进/归档并查笔记和链接; 目标同名/越界及受控rename失败，在真实UI看错误并检查磁盘; 列头预览选子集、显式direct整列；卡片move后派发；设置due并固定时钟触发现有提醒; pnpm test:architecture && pnpm run check:bundle && pnpm run lint:css | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-10.md</Path> |
| T-11所列稳定入口 | 真实host/系统集成或定向单元 | AC-048, AC-049, AC-050 | pnpm exec vitest run test/golden/user-formats.test.ts; pnpm run test:library-new-note && pnpm run test:card-new-note; 在library/folder配置0/1/2模板，逐一创建，取消菜单，重启 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-11.md</Path> |
| T-12所列稳定入口 | 真实host/系统集成或定向单元 | AC-051, AC-052, AC-053 | pnpm test && pnpm exec vitest run test/golden/user-formats.test.ts; 两分区分别隐藏重排，重启后移除/恢复某字段数据，键盘reset; pnpm run test:visible-properties && pnpm run lint:css | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path> |
| T-13所列稳定入口 | 真实host/系统集成或定向单元 | AC-054, AC-055, AC-056 | pnpm test; pnpm run test:library-group && pnpm run test:kanban-upgrade; 真实Obsidian501项section打开，检查初始cards，点击更多、筛选、move/delete | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-13.md</Path> |
| T-14所列稳定入口 | 真实host/系统集成或定向单元 | AC-057, AC-058, AC-059, AC-060 | pnpm test; pnpm exec vitest run test/golden/user-formats.test.ts; 打开纪念日配置切阳/农历、保存重启，观察映射年度提醒; pnpm test:architecture && pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-14.md</Path> |
| T-15所列稳定入口 | 真实host/系统集成或定向单元 | AC-061, AC-062, AC-063 | pnpm test && pnpm exec vitest run test/golden/user-formats.test.ts; 调整两张轮播图不同焦点及一张cover，切图/改pane宽度/重启，键盘reset; pnpm run test:library-cover && pnpm run test:banner-quote-font && pnpm run lint:css | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path> |
| T-16所列稳定入口 | 真实host/系统集成或定向单元 | AC-064, AC-065, AC-066, AC-067 | pnpm test; 主窗口+popout+两板，自定义theme/home后保存，改值，再应用和重启; 受控settings persistence失败后应用组合并查看状态，再显式重试; pnpm test:architecture && pnpm test:docs && pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> |
| T-17所列稳定入口 | 真实host/系统集成或定向单元 | AC-068, AC-069, AC-070, AC-071 | 真实Obsidian搜索一个非精选图标、关闭icons再搜，检查空查询列表DOM数; 临时vault的grid/gallery/kanban分别hover/focus/touch删除、取消和受控IO失败; pnpm test && pnpm run test:library-cover && pnpm test:architecture && pnpm run check:bundle && pnpm run lint:css | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-17.md</Path> |
| T-18所列稳定入口 | 真实host/系统集成或定向单元 | AC-072, AC-073, AC-074, AC-075, AC-076, AC-077 | node scripts/build-styles.mjs --write && pnpm run build && pnpm run lint && pnpm test && pnpm test:architecture && pnpm run check:bundle && pnpm run lint:css && pnpm test:styles && pnpm run check:styles && pnpm run check:notices && pnpm test:docs; 按.agents/skills/dev/references/testing.md启动新的临时真实Obsidian库，使用workbench-fresh-runtime.mjs及theme-matrix.mjs; node scripts/check-similarity.mjs --ours src,native/pty-server/src,scripts,test --theirs <repo外home-pages固定树> --json <临时证据路径>; 回读NOTICE、全部apex mapping与双语指南，核对77条AC到18票和证据 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- 上游注释与实现不一致（坐标持久化、readonly预览、stage直发），按固定源码事实和用户确认修正，不盲搬注释。
- 迁移混合raw/source/baseline可能让首次打开改写；以旧字节golden和读盘写次数验证，继续使用现有preserveDocument。
- provider关闭被normalize当孤儿导致布局丢失；persisted member集合与active contribution集合明确分开。
- 自动化reuse会回车，与快捷按钮既有会话语义冲突；独立路由到attachMaterial并检测实际输入字节。
- workflow状态成功而rename失败会产生部分结果；提前检测目标冲突，错误回读真实状态，不只回滚DOM、不隐藏失败。
- cap粗/细单位反复迁移和窄屏坐标覆盖；codec只迁移legacy h一次，effective布局不写canonical。
- 主题组合跨namespace持久化：使用已有SettingsStore合并flush并明确保存错误，避免新增事务系统或私有主题。
- 18票有真实写文件重叠及跨change公共接口；严格串行由总体计划安排，deps只表示语义前置，不用伪依赖掩盖冲突。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
