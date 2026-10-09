---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path>","T-04 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path>","T-04 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:git-sync-parity:sync-parity-and-recovery","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-git-sync-parity"
id: "T-04"
title: "完成同步参考对照、宿主恢复与平台说明"
status: "ready"
kind: "documentation"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: true
risk: "medium"
blocked_by: ["T-01","T-02","T-03"]
contract_ids: ["AC-001","AC-007","AC-008","AC-009","AC-011"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>docs/sync.md</Path>","<Path>docs/sync.ZH.md</Path>","<Path>docs/third-party/obsidian-git-zh.md</Path>"]
writable_paths: ["<Path>docs/sync.md</Path>","<Path>docs/sync.ZH.md</Path>","<Path>docs/third-party/obsidian-git-zh.md</Path>","<Path>docs/third-party/obsidian-git-zh.ZH.md</Path>","<Path>docs/acceptance/sync-134.md</Path>","<Path>docs/acceptance/sync-134.ZH.md</Path>","<Path>NOTICE</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-git-sync-parity::T-04（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-git-sync-parity::T-04（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-04: 完成同步参考对照、宿主恢复与平台说明

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ticket/04-sync-parity-and-recovery.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 每个同步能力都有实现/差异与验收，不把已有代码当作全平台已验证。

**当前事实：** 本地bare/定时测试已存在，外网凭据与真实宿主覆盖不能从测试通过推断。

**来源：** AC-001, AC-007, AC-008, AC-009, AC-011；issue #134；<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

逐项核销参考完整调用链、源SHA/许可、中文命令/配置/冲突UI、真实账号失败与性能限制。任何未通过核心恢复必须回修，不能靠文档“暂不支持”移除本期核心要求；mobile/submodule/blame明确支持矩阵。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 每个同步能力都有实现/差异与验收，不把已有代码当作全平台已验证。 | sync/core/flow、GitRunner、queue、automatics、编辑器冲突扩展、状态与history/diff | 自动reset/force push、mobile Git引擎、子模块管理、完整blame、hunk暂存、通用原始Git控制台 |

## 4. 要构建什么

每个同步能力都有实现/差异与验收，不把已有代码当作全平台已验证。

逐项核销参考完整调用链、源SHA/许可、中文命令/配置/冲突UI、真实账号失败与性能限制。任何未通过核心恢复必须回修，不能靠文档“暂不支持”移除本期核心要求；mobile/submodule/blame明确支持矩阵。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 逐项核销参考完整调用链、源SHA/许可、中文命令/配置/冲突UI、真实账号失败与性能限制。任何未通过核心恢复必须回修，不能靠文档“暂不支持”移除本期核心要求；mobile/submodule/blame明确支持矩阵。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-01, T-02, T-03；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 整合前3票证据和现有Git tests，不重建测试平台。
2. 执行bare双副本文本/rename/delete/binary以及实时编辑/卸载/锁场景，观测实际文件与图。
3. 在受控宿主验证认证/SSH、中文路径/大附件与恢复，记录未可用环境而不打勾。
4. 更新双语使用/归因/接受报告和逐项对照，保留raw结果定位。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | pnpm exec vitest run src/modules/sync test/sync/git-flow.test.ts | 模式/恢复/队列通过 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path> |
| 失败 | 受控真实宿主断网、credential失败、外部lock及冲突continue/abort | 本地数据保存，状态收敛 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path> |
| 回归 | pnpm test:docs; pnpm check:notices; 真实1000文件20MB附件场景 | 来源与实测边界完整 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: Lead 在 current-workspace 的一次性测试库验证本票列明的真实宿主路径；不得用构建或stub替代。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无产品数据迁移；文档依赖前3票已通过。缺账号/平台时Gate保持未验收，不能通过改文档宣称该能力不存在。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-001**：命令/manager/自动/设置/UI/冲突/认证/扩展全部逐项追踪到NAND与证据
- [ ] **AC-007**：阻止auto commit/push，双方数据可恢复，UI与repo一致
- [ ] **AC-008**：保留本地编辑与提交，明确失败步骤，不永久busy不无限重试
- [ ] **AC-009**：仓库同一writer、时钟正确、任务无泄漏，状态收敛
- [ ] **AC-011**：宿主正确刷新，实耗时/平台/认证限制如实报告，文档来源一致
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
