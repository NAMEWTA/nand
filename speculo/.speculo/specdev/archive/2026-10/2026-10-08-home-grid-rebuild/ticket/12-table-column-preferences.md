---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-12 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-12 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:table-column-preferences","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-12"
title: "交付每分区表格列显隐与排序"
status: "done"
kind: "feature"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: false
risk: "medium"
blocked_by: ["T-02"]
contract_ids: ["AC-051","AC-052","AC-053"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/home/ui/library/TableColumnsPanel.tsx</Path>","<Path>src/modules/home/ui/library/table-columns.ts</Path>","<Path>src/modules/home/ui/library/LibraryViews.tsx</Path>","<Path>src/modules/home/core/board/parser/parse.ts</Path>"]
writable_paths: ["<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/parser/</Path>","<Path>src/modules/home/ui/library/table-columns.ts</Path>","<Path>src/modules/home/ui/library/TableColumnsPanel.tsx</Path>","<Path>src/modules/home/ui/library/LibraryPanel.tsx</Path>","<Path>src/modules/home/ui/library/LibraryViews.tsx</Path>","<Path>src/modules/home/styles/074-table-view.css</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>test/golden/</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/parser/</Path>","<Path>src/modules/home/ui/library/LibraryPanel.tsx</Path>","<Path>src/modules/home/ui/library/LibraryViews.tsx</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>test/golden/</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-12（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-12（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/home/core/board/types/model.ts</Path> => 2026-10-08-home-grid-rebuild::T-12（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/core/board/parser/</Path> => 2026-10-08-home-grid-rebuild::T-12（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/library/LibraryPanel.tsx</Path> => 2026-10-08-home-grid-rebuild::T-12（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/library/LibraryViews.tsx</Path> => 2026-10-08-home-grid-rebuild::T-12（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/i18n.ts</Path> => 2026-10-08-home-grid-rebuild::T-12（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>test/golden/</Path> => 2026-10-08-home-grid-rebuild::T-12（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-12: 交付每分区表格列显隐与排序

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-12.md](../evidence/T-12.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/12-table-column-preferences.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户能为每分区保存表格列顺序和显隐，数据变化后偏好仍可靠。

**规划时基线：** 当前visibleProperties是卡片badge用途，不能直接当表格列设置；Table视图自行派生，缺少tableOrder/tableHidden和picker。

**来源：** AC-051, AC-052, AC-053；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

tableOrder持完整已知偏好，tableHidden独立，派生candidate追加新字段；缺席字段不删偏好。reset回默认派生。该配置不能改frontmatter值；两个分区互不影响。UI是真实button/input，pointer和keyboard都能排序，焦点不因重渲染丢失；不照搬upstream pointer-only div。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户能为每分区保存表格列顺序和显隐，数据变化后偏好仍可靠。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

用户能为每分区保存表格列顺序和显隐，数据变化后偏好仍可靠。

tableOrder持完整已知偏好，tableHidden独立，派生candidate追加新字段；缺席字段不删偏好。reset回默认派生。该配置不能改frontmatter值；两个分区互不影响。UI是真实button/input，pointer和keyboard都能排序，焦点不因重渲染丢失；不照搬upstream pointer-only div。

## 5. 实现契约

- **入口、输入输出、状态和错误：** tableOrder持完整已知偏好，tableHidden独立，派生candidate追加新字段；缺席字段不删偏好。reset回默认派生。该配置不能改frontmatter值；两个分区互不影响。UI是真实button/input，pointer和keyboard都能排序，焦点不因重渲染丢失；不照搬upstream pointer-only div。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-02；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 实现候选/order/hidden纯逻辑与codec，避免复用错误的visibleProperties语义。
2. 建立lazy Preact列配置面板，加入可达显隐、上移/下移和reset。
3. 接LibraryPanel工具入口及LibraryViews列渲染，写当前section配置。
4. 验证缺席/新增字段、两section独立及golden/实际键盘。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 格式逻辑 | pnpm test && pnpm exec vitest run test/golden/user-formats.test.ts | 新增table-columns相邻Vitest覆盖缺席/新增/重置；原golden不漂移 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path> |
| 真实 | 两分区分别隐藏重排，重启后移除/恢复某字段数据，键盘reset | 偏好独立持久化、字段返回仍原设置、操作可达 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path> |
| 复用 | pnpm run test:visible-properties && pnpm run lint:css | 卡片badge原语义不变，表格样式规范 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 两分区独立、字段消失/返回、新列、键盘顺序/隐藏/reset。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

新字段只在用户编辑本section时写；reset仅删列偏好不删笔记属性。回退不会改用户原始值，未知新字段应被preserve保留。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-051**：只影响当前分区，显隐/顺序恢复，内容值不改
- [ ] **AC-052**：缺席字段偏好保留，新字段追加可见，原字段返回仍按原order/hidden
- [ ] **AC-053**：可见焦点及原生控件完成操作，重置恢复派生默认列
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
