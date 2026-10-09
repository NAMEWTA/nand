---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-18 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/skill-maintenance.md</Path>","sha256":"2689e1c377a34da0a76e8091ea08140c252c8907ef40fc1a3ad39a0ae2c0091a","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-18 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:integrated-home-acceptance","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-18"
title: "完成看板与新闻智能体的联合验收和交付文档"
status: "ready"
kind: "documentation"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-01","T-02","T-03","T-04","T-05","T-06","T-07","T-08","T-09","T-10","T-11","T-12","T-13","T-14","T-15","T-16","T-17"]
contract_ids: ["AC-072","AC-073","AC-074","AC-075","AC-076","AC-077"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>docs/dashboard.md</Path>","<Path>docs/dashboard.ZH.md</Path>","<Path>docs/workbench.md</Path>","<Path>docs/workbench.ZH.md</Path>","<Path>docs/agent-workbench.md</Path>","<Path>docs/agent-workbench.ZH.md</Path>","<Path>docs/data.md</Path>","<Path>docs/data.ZH.md</Path>","<Path>docs/third-party/apex-dashboard.md</Path>","<Path>docs/third-party/apex-dashboard.ZH.md</Path>","<Path>main.js</Path>","<Path>styles.css</Path>"]
writable_paths: ["<Path>docs/dashboard.md</Path>","<Path>docs/dashboard.ZH.md</Path>","<Path>docs/workbench.md</Path>","<Path>docs/workbench.ZH.md</Path>","<Path>docs/agent-workbench.md</Path>","<Path>docs/agent-workbench.ZH.md</Path>","<Path>docs/data.md</Path>","<Path>docs/data.ZH.md</Path>","<Path>docs/third-party/apex-dashboard.md</Path>","<Path>docs/third-party/apex-dashboard.ZH.md</Path>","<Path>.agents/skills/dev/references/module-authoring.md</Path>","<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path>","<Path>scripts/obsidian-acceptance/theme-matrix.mjs</Path>","<Path>scripts/check-similarity.mjs</Path>","<Path>NOTICE</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-18（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-18（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-18: 完成看板与新闻智能体的联合验收和交付文档

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/18-integrated-home-acceptance.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 在全部feature和news贡献可用后验证完整用户旅程，交付可追溯的双语文档、许可和实际证据。

**当前事实：** 各票应已各自提供功能/错误证据；本票不是留给前票的实现兜底。当前研究尚未运行构建/真实UI/相似度，不可复用“未测”当通过。

**来源：** AC-072, AC-073, AC-074, AC-075, AC-076, AC-077；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

全AC映射到实际ticket证据并核对所有P5项/#141；在已集成树跑一次完整必要门禁，只有新失败/新更改才重跑扩大。HOME_WIDGETS/news和agent共有接口由指定owner单一实现；严格串行，产物最终统一生成。GPL对照树仅供脚本数字/路径报告，不读源，NOTICE/header映射人工核对不能被check:notices替代。发布/PR/issue closure不属本票隐含操作。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 在全部feature和news贡献可用后验证完整用户旅程，交付可追溯的双语文档、许可和实际证据。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

在全部feature和news贡献可用后验证完整用户旅程，交付可追溯的双语文档、许可和实际证据。

全AC映射到实际ticket证据并核对所有P5项/#141；在已集成树跑一次完整必要门禁，只有新失败/新更改才重跑扩大。HOME_WIDGETS/news和agent共有接口由指定owner单一实现；严格串行，产物最终统一生成。GPL对照树仅供脚本数字/路径报告，不读源，NOTICE/header映射人工核对不能被check:notices替代。发布/PR/issue closure不属本票隐含操作。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 全AC映射到实际ticket证据并核对所有P5项/#141；在已集成树跑一次完整必要门禁，只有新失败/新更改才重跑扩大。HOME_WIDGETS/news和agent共有接口由指定owner单一实现；严格串行，产物最终统一生成。GPL对照树仅供脚本数字/路径报告，不读源，NOTICE/header映射人工核对不能被check:notices替代。发布/PR/issue closure不属本票隐含操作。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 核对18票AC与每项功能实际证据，确认新闻贡献依赖已完成且公共接口无第二实现。
2. 同步dashboard/workbench/agent/data及module-authoring英中指南与第三方映射，保留许可原文。
3. 在最终集成树生成styles/main并运行全部必要build/lint/test/architecture/bundle/styles/notices/docs。
4. 用既有real-Obsidian流程覆盖模块开关、布局/重启、skills/workflow/news、三个宽度/light-dark三preset/keyboard/reduce/popout。
5. 在repo外准备固定GPL参考树，仅运行similarity报数值/路径并人工核对许可来源，不接触实现源码。
6. 记录平台未验证、真实失败和剩余项；只有全部AC满足才向后续review/交付Work移交。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 完整门禁 | node scripts/build-styles.mjs --write && pnpm run build && pnpm run lint && pnpm test && pnpm test:architecture && pnpm run check:bundle && pnpm run lint:css && pnpm test:styles && pnpm run check:styles && pnpm run check:notices && pnpm test:docs | 各门禁通过、零警告、120KiB和模块预算遵守，产物可复现 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> |
| 用户旅程 | 按.agents/skills/dev/references/testing.md启动新的临时真实Obsidian库，使用workbench-fresh-runtime.mjs及theme-matrix.mjs | fresh+restart与实际UI矩阵通过，新闻/技能/工作流跨模块恢复正确；未跑平台明确记录 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> |
| GPL边界 | node scripts/check-similarity.mjs --ours src,native/pty-server/src,scripts,test --theirs <repo外home-pages固定树> --json <临时证据路径> | 输出仅路径/数字，无GPL源码被阅读/搬入；异常高raw match按许可合同处理 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> |
| 文档覆盖 | 回读NOTICE、全部apex mapping与双语指南，核对77条AC到18票和证据 | 没有遗漏功能、伪造验证、陈旧src/view路径或过度测试/兜底体系 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 完整功能与news联动、fresh/restart、light/dark三preset、三宽度/phone能力、keyboard/reduce/popout；真实平台能力如缺失必须明示。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

文档/生成产物可从当前实现重建；本票无新的数据迁移或不可逆发布。测试仅一次性临时库；保留引用证据。阻断项留明文，不将不完整结果标完成。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-072**：新闻/skills/automations同registry，关闭各模块保布局，完整用户旅程可用
- [ ] **AC-073**：零lint警告、全部pnpm test通过，启动≤120KiB及home/总包预算不超，产物同步
- [ ] **AC-074**：无新增literal color/!important/:has/raw z-index违规，tokens与实际主题可用
- [ ] **AC-075**：键盘/焦点/触控布局正确，卸载无遗留；记录未验证平台，不以build代替UI证据
- [ ] **AC-076**：MIT声明/映射完整，双语dashboard/workbench/agent/data/module指南同步；GPL对照只报路径/数值，无代码抄写
- [ ] **AC-077**：无遗漏P5/bug，无伪造测试/平台/共识，无过度兜底或新测试框架；issue关闭/发布另经所属workflow授权
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
