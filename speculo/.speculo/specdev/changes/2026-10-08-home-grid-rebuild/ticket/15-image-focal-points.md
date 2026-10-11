---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-15 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-15 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:image-focal-points","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-15"
title: "支持封面和横幅逐图焦点调整"
status: "ready"
kind: "feature"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: true
risk: "medium"
blocked_by: ["T-02"]
contract_ids: ["AC-061","AC-062","AC-063"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/home/core/board/focal-point.ts</Path>","<Path>src/modules/home/ui/media/FocalPointPanel.tsx</Path>","<Path>src/modules/home/core/board/parser/parse.ts</Path>","<Path>src/modules/home/ui/banner/banner.ts</Path>"]
writable_paths: ["<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/focal-point.ts</Path>","<Path>src/modules/home/core/board/parser/</Path>","<Path>src/modules/home/ui/banner/banner.ts</Path>","<Path>src/modules/home/ui/view/banner-behavior.ts</Path>","<Path>src/modules/home/ui/renderer/render-card.tsx</Path>","<Path>src/modules/home/ui/ui/card-edit-modal.ts</Path>","<Path>src/modules/home/ui/media/FocalPointPanel.tsx</Path>","<Path>src/modules/home/styles/011-banner.css</Path>","<Path>src/modules/home/styles/055-project-cover-image.css</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>test/golden/</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/parser/</Path>","<Path>src/modules/home/ui/view/banner-behavior.ts</Path>","<Path>src/modules/home/ui/renderer/render-card.tsx</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>test/golden/</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-15（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-15（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/home/core/board/types/model.ts</Path> => 2026-10-08-home-grid-rebuild::T-15（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/core/board/parser/</Path> => 2026-10-08-home-grid-rebuild::T-15（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/view/banner-behavior.ts</Path> => 2026-10-08-home-grid-rebuild::T-15（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/ui/renderer/render-card.tsx</Path> => 2026-10-08-home-grid-rebuild::T-15（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/i18n.ts</Path> => 2026-10-08-home-grid-rebuild::T-15（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>test/golden/</Path> => 2026-10-08-home-grid-rebuild::T-15（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-15: 支持封面和横幅逐图焦点调整

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-15.md](../evidence/T-15.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/15-image-focal-points.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户能为每张横幅图和卡片封面保存独立crop焦点，通过鼠标和键盘都可操作。

**规划时基线：** 当前无对应focal模型/编辑UI；apex picker的纯0..100语义可适配但其pointer-only div要加强。

**来源：** AC-061, AC-062, AC-063；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

point是0..100整百分比，缺失center；imagePos按路径映射，card cover单独point，carousel各图独立。preview即actual background/object-position含义，reset只回center。非法值显示规范化而只读不写回；用户编辑该图才更新其字段，保留其他图/source。资源rename按已有事件迁移引用，不通过猜测丢焦点。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户能为每张横幅图和卡片封面保存独立crop焦点，通过鼠标和键盘都可操作。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

用户能为每张横幅图和卡片封面保存独立crop焦点，通过鼠标和键盘都可操作。

point是0..100整百分比，缺失center；imagePos按路径映射，card cover单独point，carousel各图独立。preview即actual background/object-position含义，reset只回center。非法值显示规范化而只读不写回；用户编辑该图才更新其字段，保留其他图/source。资源rename按已有事件迁移引用，不通过猜测丢焦点。

## 5. 实现契约

- **入口、输入输出、状态和错误：** point是0..100整百分比，缺失center；imagePos按路径映射，card cover单独point，carousel各图独立。preview即actual background/object-position含义，reset只回center。非法值显示规范化而只读不写回；用户编辑该图才更新其字段，保留其他图/source。资源rename按已有事件迁移引用，不通过猜测丢焦点。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-02；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 适配pure parse/format/clamp/center函数和board codec，记录固定来源。
2. 建lazy Preact预览面板，提供pointer、键盘/数字输入与reset。
3. 接banner每图和card编辑/渲染，carousel切换读对应point。
4. 覆盖两图独立、重启、手改异常与旧center字节，补键盘/响应式证据。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 格式 | pnpm test && pnpm exec vitest run test/golden/user-formats.test.ts | pure point和新字段测试通过，旧无point文件不变 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path> |
| 真实 | 调整两张轮播图不同焦点及一张cover，切图/改pane宽度/重启，键盘reset | 每图crop独立正确，实际预览一致，reset回center | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path> |
| 回归 | pnpm run test:library-cover && pnpm run test:banner-quote-font && pnpm run lint:css | 既有封面/横幅行为保留、无违规样式 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: carousel两图/card、pointer+键盘、reset、resize与重启。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

旧center默认不写新字段，点编辑无图像文件修改；删除/重置焦点可恢复center。任何相册路径变更只动相关映射，不批量删除未知frontmatter。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-061**：每图/cover独立0..100焦点恢复，实际crop匹配预览
- [ ] **AC-062**：两种输入得到同一焦点，reset中心，尺寸变化不丢值，可访问性达标
- [ ] **AC-063**：旧center显示不变，非法显示被归一化但不自动写源；编辑只更新相关图
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
