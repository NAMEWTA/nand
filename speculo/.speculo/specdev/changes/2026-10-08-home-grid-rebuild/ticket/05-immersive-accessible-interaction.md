---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-05 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-05 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:immersive-accessible-interaction","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-05"
title: "完成网格pointer与键盘移动缩放、取消和响应式"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-04"]
contract_ids: ["AC-016","AC-017","AC-018","AC-019","AC-020"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/home/ui/immersive/pointer-controller.ts</Path>","<Path>src/modules/home/ui/immersive/keyboard-controller.ts</Path>","<Path>src/modules/home/ui/immersive/ImmersiveTile.tsx</Path>","<Path>src/modules/home/styles/immersive.css</Path>"]
writable_paths: ["<Path>src/modules/home/ui/immersive/pointer-controller.ts</Path>","<Path>src/modules/home/ui/immersive/keyboard-controller.ts</Path>","<Path>src/modules/home/ui/immersive/layout-controller.ts</Path>","<Path>src/modules/home/ui/immersive/ImmersiveBoard.tsx</Path>","<Path>src/modules/home/ui/immersive/ImmersiveTile.tsx</Path>","<Path>src/modules/home/core/board/immersive-grid.ts</Path>","<Path>src/modules/home/styles/immersive.css</Path>","<Path>src/modules/home/i18n.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/home/ui/immersive/ImmersiveTile.tsx</Path>","<Path>src/modules/home/i18n.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-05（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-05（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/home/ui/immersive/ImmersiveTile.tsx</Path> => 2026-10-08-home-grid-rebuild::T-05（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/i18n.ts</Path> => 2026-10-08-home-grid-rebuild::T-05（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-05: 完成网格pointer与键盘移动缩放、取消和响应式

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/05-immersive-accessible-interaction.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户能用pointer或完全键盘自由排列，任何取消都恢复原位且不写错布局。

**当前事实：** 上游pointer实现有ghost/snap/swap但无键盘/Esc；每个other重算布局和静止边缘不滚动也不应照搬。NAND既有HTML5/长按适用于传统布局，可保持。

**来源：** AC-016, AC-017, AC-018, AC-019, AC-020；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

preview→commit/cancel状态机记录不可变起点；超过5px启动移动，8px吸附，major overlap swap验证全局不重叠，resize obey min。每帧一个packing快照。Esc/pointercancel/unmount零写入；commit一次。键盘Enter/Space pickup/drop、方向移动、Shift缩放、live region；reduced motion无过渡，按owner el.win调度。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户能用pointer或完全键盘自由排列，任何取消都恢复原位且不写错布局。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

用户能用pointer或完全键盘自由排列，任何取消都恢复原位且不写错布局。

preview→commit/cancel状态机记录不可变起点；超过5px启动移动，8px吸附，major overlap swap验证全局不重叠，resize obey min。每帧一个packing快照。Esc/pointercancel/unmount零写入；commit一次。键盘Enter/Space pickup/drop、方向移动、Shift缩放、live region；reduced motion无过渡，按owner el.win调度。

## 5. 实现契约

- **入口、输入输出、状态和错误：** preview→commit/cancel状态机记录不可变起点；超过5px启动移动，8px吸附，major overlap swap验证全局不重叠，resize obey min。每帧一个packing快照。Esc/pointercancel/unmount零写入；commit一次。键盘Enter/Space pickup/drop、方向移动、Shift缩放、live region；reduced motion无过渡，按owner el.win调度。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-04；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 实现共享gesture状态与一次布局快照，让pointer/keyboard共用placement操作。
2. 加入标题握柄、控件排除、ghost/snap/swap/edge及角边resize，保持传统DND边界。
3. 接入键盘拾取/缩放/取消和live公告，调整focus/touch target。
4. 用rAF持续edge scroll并在全部退出路径清理；observer避免自激无限重测。
5. 在实际窗口/phone投影/popout和reduce场景验证并补关键取消/碰撞用例。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | 真实Obsidian对不等尺寸tiles执行move/snap/swap/resize与边缘静止拖动 | 预览即落点，提交无重叠，边缘继续滚动且释放停止 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> |
| 取消回归 | 真实Esc/pointercancel/关闭page操作并检查board写次数 | 起点恢复，零写入且无ghost/timer | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> |
| 可访问性 | 仅键盘执行完整move/resize/cancel，开启reduced-motion及popout | live播报正确、focus稳定、reduce无过渡、每窗独立 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> |
| 代码 | pnpm test && pnpm run lint && pnpm run lint:css && pnpm run check:styles | 只新增关键gesture/placement测试，规范通过 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: pointer与完整键盘、取消三路径、snap/swap、持续edge scroll、reduce/popout/touch。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

gesture预览不改变durable模型，是本票取消窗口；只有放下后用户编辑持久化。回退交互实现不改tile schema，无不可逆数据操作。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-016**：幽灵与最终落点一致，8px吸附与min尺寸生效，commit后不重叠；控件不误拖
- [ ] **AC-017**：恢复手势起点和焦点，零布局写入，ghost/capture/timer全部结束
- [ ] **AC-018**：完全键盘可移动缩放提交取消，读屏播报位置/尺寸，焦点保持可见
- [ ] **AC-019**：自动滚动持续，落点随滚动准确；释放即停止，不泄漏rAF
- [ ] **AC-020**：只有允许的transform/opacity可动画；reduce无过渡，功能仍工作；各窗口状态与清理独立
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
