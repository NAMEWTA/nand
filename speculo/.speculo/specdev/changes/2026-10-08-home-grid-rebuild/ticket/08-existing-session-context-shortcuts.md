---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-08 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"dfec45b11d78296560406f2808cf3824b271ea803b59d8d1ff87e105d12327b1","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-08 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:existing-session-context-shortcuts","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-08"
title: "接通既有会话只粘贴与各入口上下文技能"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-07"]
contract_ids: ["AC-031","AC-032","AC-033","AC-034","AC-035"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/agent/services/prompt-dispatch.ts</Path>","<Path>src/modules/home/ui/notes/QuickNotesPanel.tsx</Path>","<Path>src/modules/home/ui/cards/CardPanel.tsx</Path>","<Path>src/modules/home/core/skills/context.ts</Path>"]
writable_paths: ["<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/agent/services/prompt-dispatch.ts</Path>","<Path>src/modules/agent/services/session-material.ts</Path>","<Path>src/modules/automations/core/</Path>","<Path>src/modules/automations/services/runtime.ts</Path>","<Path>src/shared/automation/types.ts</Path>","<Path>src/modules/home/services/skill-shortcuts.ts</Path>","<Path>src/modules/home/ui/skills/</Path>","<Path>src/modules/home/ui/notes/QuickNotesPanel.tsx</Path>","<Path>src/modules/home/ui/cards/CardPanel.tsx</Path>","<Path>src/modules/home/ui/view/callbacks.ts</Path>","<Path>src/modules/home/core/skills/context.ts</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>src/modules/automations/i18n.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/home/ui/skills/</Path>","<Path>src/modules/home/ui/view/callbacks.ts</Path>","<Path>src/modules/home/i18n.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-08（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-08（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/agent/api.ts</Path> => 2026-10-08-home-grid-rebuild::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/skills/</Path> => 2026-10-08-home-grid-rebuild::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/view/callbacks.ts</Path> => 2026-10-08-home-grid-rebuild::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/i18n.ts</Path> => 2026-10-08-home-grid-rebuild::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-08: 接通既有会话只粘贴与各入口上下文技能

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/08-existing-session-context-shortcuts.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户从快念/卡片或技能组件把准确材料粘贴到指定已有agent输入框，同时看到诚实的待发送回执。

**当前事实：** AGENT_SESSIONS.list没有agentId，attachMaterial已有只粘贴和10s readiness；automation reuse会Enter，因此不能误用。现快念与普通卡片没有技能按钮。

**来源：** AC-031, AC-032, AC-033, AC-034, AC-035；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

选择existing验证session仍interactive/running且target相配，失败让用户重选不静默fresh。一次attachMaterial含finalPrompt/files，不附Enter。快念/card/pipeline共享context DTO；stage默认preview可选子集，directSend完整当前列paths，空列不扩大。pasted只记录交付事实，模型状态不写succeeded。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户从快念/卡片或技能组件把准确材料粘贴到指定已有agent输入框，同时看到诚实的待发送回执。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

用户从快念/卡片或技能组件把准确材料粘贴到指定已有agent输入框，同时看到诚实的待发送回执。

选择existing验证session仍interactive/running且target相配，失败让用户重选不静默fresh。一次attachMaterial含finalPrompt/files，不附Enter。快念/card/pipeline共享context DTO；stage默认preview可选子集，directSend完整当前列paths，空列不扩大。pasted只记录交付事实，模型状态不写succeeded。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 选择existing验证session仍interactive/running且target相配，失败让用户重选不静默fresh。一次attachMaterial含finalPrompt/files，不附Enter。快念/card/pipeline共享context DTO；stage默认preview可选子集，directSend完整当前列paths，空列不扩大。pasted只记录交付事实，模型状态不写succeeded。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-07；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 增强公共session summary的target辨识且兼容现有调用，dispatch增加existing严格路由。
2. 实现一次material attach和pasted receipt，不借用runtime reuse自动发送。
3. 为quicknote/card添加可配置技能入口，抽取当前路径/标题/选区/列集合的纯context构建。
4. 完成stage预览/显式全列直发语义的公共context与UI能力，待T-10具体列接入。
5. 验证实际terminal字节/回执、失效session、文件rename后的上下文。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 安全语义 | pnpm test | 在现有agent/services/terminal/session.test.ts相邻新增material/dispatch用例，捕获一次paste且没有
自动Enter；无平行runtime测试平台 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> |
| 真实操作 | 真实interactive session中由quicknote/card发送，再检查输入框与回执 | 文本未执行且可由用户编辑；显示已粘贴待发送，不宣称任务完成 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> |
| 失效上下文 | 保存existing id后关闭会话，rename/move卡片文件再触发 | 重选提示不启动fresh；preview路径为最新值 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> |
| 回归 | pnpm run test:safety-regressions && pnpm test:architecture | 现有浏览器attach与自动化reuse原语义仍各自正确 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: existing零Enter、失效目标、快念/card文本、stage范围公共能力、fresh回归。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

保持原attachMaterial兼容，新增summary字段可选。按钮目标失效可重新选；粘贴是用户可编辑的未发送块，不自动撤回或清空其他输入。新receipt字段经格式兼容读处理，不改旧执行状态意义。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-031**：AGENT_SESSIONS.attachMaterial接一次未发送块，实际输入中没有自动Enter
- [ ] **AC-032**：要求重新选择/显示不可用，不静默启动fresh或发到错误会话
- [ ] **AC-033**：path/title/input来自触发点，card移动/重命名后用当前路径；共享同一派发实现
- [ ] **AC-034**：预览可选子集；显式直发展开整列paths；空列不扩展全库、不沿用旧选区
- [ ] **AC-035**：回执显示已粘贴/待用户发送，绝不显示模型任务succeeded；fresh运行仍跟踪真实completion
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
