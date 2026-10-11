---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:git-sync-parity:vault-index-boundary","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-git-sync-parity"
id: "T-01"
title: "阻止库外暂存混入并明确私有数据同步范围"
status: "done"
kind: "bug"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: []
contract_ids: ["AC-004","AC-005"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/sync/core/repo.ts</Path>","<Path>src/modules/sync/core/ports.ts</Path>","<Path>src/modules/sync/core/flow.ts</Path>"]
writable_paths: ["<Path>src/modules/sync/core/repo.ts</Path>","<Path>src/modules/sync/core/ports.ts</Path>","<Path>src/modules/sync/core/flow.ts</Path>","<Path>src/modules/sync/platform/desktop/host.ts</Path>","<Path>src/modules/sync/services/sync-service.ts</Path>","<Path>src/modules/sync/ui/sync-presentation.tsx</Path>","<Path>src/modules/sync/i18n.ts</Path>","<Path>test/sync/git-flow.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/sync/core/repo.ts</Path>","<Path>src/modules/sync/core/ports.ts</Path>","<Path>src/modules/sync/core/flow.ts</Path>","<Path>src/modules/sync/platform/desktop/host.ts</Path>","<Path>src/modules/sync/services/sync-service.ts</Path>","<Path>src/modules/sync/ui/sync-presentation.tsx</Path>","<Path>src/modules/sync/i18n.ts</Path>","<Path>test/sync/git-flow.test.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-git-sync-parity::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-git-sync-parity::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/sync/core/repo.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/sync/core/ports.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/sync/core/flow.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/sync/platform/desktop/host.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/sync/services/sync-service.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/sync/ui/sync-presentation.tsx</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/sync/i18n.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>test/sync/git-flow.test.ts</Path> => 2026-10-08-git-sync-parity::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-01: 阻止库外暂存混入并明确私有数据同步范围

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-01.md](../evidence/T-01.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ticket/01-vault-index-boundary.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** vault处于更大repo时任何NAND提交都不带入其它项目暂存。 stage/unstage/discard/markResolved也不越出vault边界。

**规划时基线：** stageAll限cwd但commit和stagedPaths读全index，现有文档声称只提交vault需实证。

**来源：** AC-004, AC-005；issue #134；<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

在提交前检查整个index并计算授权相对范围，范围外存在暂存即拒绝且给出可执行处理；不要自动unstage。literal路径重命名双方都检查。新初始化ignore显示私有设备数据说明，已有ignore/tracked内容不隐式删除。 stage、unstage、discard和markResolved均校验vault相对literal路径及rename双方。unstage-all含unborn只作用于vault路径集合，不能git reset全index或用:/移除整个repo；库外哨兵必须保持原index blob与mode。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| vault处于更大repo时任何NAND提交都不带入其它项目暂存。 stage/unstage/discard/markResolved也不越出vault边界。 | sync/core/flow、GitRunner、queue、automatics、编辑器冲突扩展、状态与history/diff | 自动reset/force push、mobile Git引擎、子模块管理、完整blame、hunk暂存、通用原始Git控制台 |

## 4. 要构建什么

vault处于更大repo时任何NAND提交都不带入其它项目暂存。 stage/unstage/discard/markResolved也不越出vault边界。

在提交前检查整个index并计算授权相对范围，范围外存在暂存即拒绝且给出可执行处理；不要自动unstage。literal路径重命名双方都检查。新初始化ignore显示私有设备数据说明，已有ignore/tracked内容不隐式删除。 stage、unstage、discard和markResolved均校验vault相对literal路径及rename双方。unstage-all含unborn只作用于vault路径集合，不能git reset全index或用:/移除整个repo；库外哨兵必须保持原index blob与mode。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 在提交前检查整个index并计算授权相对范围，范围外存在暂存即拒绝且给出可执行处理；不要自动unstage。literal路径重命名双方都检查。新初始化ignore显示私有设备数据说明，已有ignore/tracked内容不隐式删除。 stage、unstage、discard和markResolved均校验vault相对literal路径及rename双方。unstage-all含unborn只作用于vault路径集合，不能git reset全index或用:/移除整个repo；库外哨兵必须保持原index blob与mode。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 用临时父repo/vault子目录+outside staged建立真实复现。
2. 在纯core定义范围结果、desktop提供canonical边界；四种commit入口统一硬门。
3. 补用户反馈与stage/unstage可见范围，保留原index与ignore。
4. 运行真实Git index/commit树比较及既有模式用例。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | pnpm exec vitest run test/sync/git-flow.test.ts src/modules/sync/core/core.test.ts | vault内smart/staged/all保持 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path> |
| 失败 | 父repo预暂存outside.txt，再在vault执行各提交模式 | 拒绝且outside仍暂存，HEAD不变 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path> |
| 回归 | 中文/空格/rename路径+无upstream及已有ignore | 边界准确，无静默清index | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path> |
| 取消暂存及路径越界 | 父repo外部staged哨兵，分别在有HEAD/unborn执行unstage-all及包含../外部或跨界rename输入 | 外部index字节/模式不变，越界操作拒绝且vault内正常取消暂存 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: Lead 在 current-workspace 的一次性测试库验证本票列明的真实宿主路径；不得用构建或stub替代。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无格式迁移。先引入检查再接四种入口；若路径判定不确定保留工作区并阻塞commit。回退实现不得拿降低门禁作为验收通过。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-004**：不会提交/改动范围外index；阻塞明确；vault内所选内容准确
- [ ] **AC-005**：staged-first和独立auto setting准确；无变更仍push已有提交；重跑不重复commit
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
