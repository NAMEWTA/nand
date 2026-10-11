---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-09 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"add18e61df97494df0d6f0ab45a5920bc0132779e6a33d53bc6c41ff1b701aab","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-09 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:agent-skill-discovery","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-09"
title: "实现技能发现、记忆与目标能力选择器"
status: "done"
kind: "feature"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: false
risk: "medium"
blocked_by: ["T-07"]
contract_ids: ["AC-036","AC-037","AC-038","AC-039"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/agent/core/skills/registry.ts</Path>","<Path>src/modules/agent/platform/skills/vault-skills.ts</Path>","<Path>src/modules/agent/platform/desktop/skills/folder-skills.ts</Path>","<Path>src/modules/agent/services/skill-directory.ts</Path>","<Path>src/modules/home/ui/skills/SkillPicker.tsx</Path>"]
writable_paths: ["<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/agent/core/skills/registry.ts</Path>","<Path>src/modules/agent/platform/skills/vault-skills.ts</Path>","<Path>src/modules/agent/platform/desktop/skills/folder-skills.ts</Path>","<Path>src/modules/agent/services/skill-directory.ts</Path>","<Path>src/modules/agent/settings.ts</Path>","<Path>src/modules/agent/module.ts</Path>","<Path>src/modules/agent/i18n.ts</Path>","<Path>src/modules/home/ui/skills/SkillPicker.tsx</Path>","<Path>src/modules/home/ui/skills/skill-config.ts</Path>","<Path>docs/agent-workbench.md</Path>","<Path>docs/agent-workbench.ZH.md</Path>","<Path>docs/third-party/apex-dashboard.md</Path>","<Path>docs/third-party/apex-dashboard.ZH.md</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/home/ui/skills/SkillPicker.tsx</Path>","<Path>src/modules/home/ui/skills/skill-config.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-09（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-09（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/agent/api.ts</Path> => 2026-10-08-home-grid-rebuild::T-09（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/skills/SkillPicker.tsx</Path> => 2026-10-08-home-grid-rebuild::T-09（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/skills/skill-config.ts</Path> => 2026-10-08-home-grid-rebuild::T-09（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-09: 实现技能发现、记忆与目标能力选择器

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-09.md](../evidence/T-09.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/09-agent-skill-discovery.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 无需记住技能名即可从库内/历史/显式桌面目录选择，调用语法按真实agent能力。

**规划时基线：** NAND无registry；apex已有三目录但adapter可能重复拼路径，name解析扫描正文且Node在普通文件，需分层重写。

**来源：** AC-036, AC-037, AC-038, AC-039；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

agent公开目录端口按agentId返回name/source列表；读取SKILL.md frontmatter，不把任意正文name当技能。vault list路径按宿主返回约定规范化一次。已保存有效名字才记忆；额外目录device scope显式opt-in，~仅desktop展开，空配置零额外扫描。目标token按官方文档可追溯，未知能力不猜、允许普通prompt。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 无需记住技能名即可从库内/历史/显式桌面目录选择，调用语法按真实agent能力。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

无需记住技能名即可从库内/历史/显式桌面目录选择，调用语法按真实agent能力。

agent公开目录端口按agentId返回name/source列表；读取SKILL.md frontmatter，不把任意正文name当技能。vault list路径按宿主返回约定规范化一次。已保存有效名字才记忆；额外目录device scope显式opt-in，~仅desktop展开，空配置零额外扫描。目标token按官方文档可追溯，未知能力不猜、允许普通prompt。

## 5. 实现契约

- **入口、输入输出、状态和错误：** agent公开目录端口按agentId返回name/source列表；读取SKILL.md frontmatter，不把任意正文name当技能。vault list路径按宿主返回约定规范化一次。已保存有效名字才记忆；额外目录device scope显式opt-in，~仅desktop展开，空配置零额外扫描。目标token按官方文档可追溯，未知能力不猜、允许普通prompt。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-07；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 核对六CLI官方当前技能调用/发现文档并记录URL日期及支持状态，更新公共capability。
2. 实现pure registry name/merge与vault DataAdapter扫描，排除重复prefix/非法名。
3. 把额外目录read/~放desktop adapter，接device设置且不默认扫描home。
4. 建立agent服务和picker来源分组/刷新/记忆，home只调公开api。
5. 覆盖实际adapter路径、frontmatter和off/mobile场景，完善帮助。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 功能 | pnpm test | 新增registry/adapter用例沿用agent/core与platform现有Vitest，覆盖完整vault-relative path、重名、正文name、缺文件、remembered隔离 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path> |
| 真实 | 临时vault建立三个约定技能目录，保存一个name，配置/清空额外目录，再在mobile等价环境打开picker | 来源/名称准确，clear额外目录后不再读库外，mobile不触发Node | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path> |
| 规范 | pnpm test:architecture && pnpm run check:bundle && pnpm test:docs | Node仅desktop，目录和picker懒加载，官方能力证据文档可追溯 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 三目录发现+remembered、额外目录opt-in、模块不可用/移动端降级与至少已支持CLI调用smoke。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

扫描只读，无迁移用户SKILL.md；已记住名可清除。额外路径仅device配置，可随时移除，错误只影响该来源不改变技能文件。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-036**：仅frontmatter name或目录fallback成为名称，去重保留来源；DataAdapter path无重复base
- [ ] **AC-037**：记住已保存名字并标remembered；其他agent隔离，放弃的输入不污染目录
- [ ] **AC-038**：空配置不读库外；配置仅desktop展开home读取；mobile显示库内/remembered，不执行Node
- [ ] **AC-039**：交付映射有文档URL/日期，支持则正确调用；无证据不猜prefix，不支持仍可普通prompt
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
