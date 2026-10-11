---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-16 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-16 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/theme.md</Path>","sha256":"3aba13e73177cce60c415b06000f94b252cef218a8c0af6a79573f8af3b86a06","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:named-global-appearance","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-16"
title: "保存并应用全局主题与首页组合外观"
status: "done"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "medium"
blocked_by: []
contract_ids: ["AC-064","AC-065","AC-066","AC-067"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/home/services/appearance-presets.ts</Path>","<Path>src/modules/home/ui/appearance/AppearancePresetsPanel.tsx</Path>","<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/ui/appearance/theme-studio-modal.ts</Path>"]
writable_paths: ["<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/settings.ts</Path>","<Path>src/modules/home/settings.ts</Path>","<Path>src/modules/home/services/appearance-presets.ts</Path>","<Path>src/modules/home/services/home-host.ts</Path>","<Path>src/modules/home/ui/appearance/theme-studio-modal.ts</Path>","<Path>src/modules/home/ui/appearance/AppearancePresetsPanel.tsx</Path>","<Path>src/modules/home/ui/appearance/appearance.ts</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>src/theme/settings.ts</Path>","<Path>src/theme/runtime.ts</Path>","<Path>src/app/settings/appearance.ts</Path>","<Path>src/shared/settings/store.ts</Path>","<Path>docs/dashboard.md</Path>","<Path>docs/dashboard.ZH.md</Path>","<Path>docs/data.md</Path>","<Path>docs/data.ZH.md</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/settings.ts</Path>","<Path>src/modules/home/services/home-host.ts</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>docs/dashboard.md</Path>","<Path>docs/dashboard.ZH.md</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-16（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-16（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/home/core/board/types/model.ts</Path> => 2026-10-08-home-grid-rebuild::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/core/board/settings.ts</Path> => 2026-10-08-home-grid-rebuild::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/services/home-host.ts</Path> => 2026-10-08-home-grid-rebuild::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/i18n.ts</Path> => 2026-10-08-home-grid-rebuild::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>docs/dashboard.md</Path> => 2026-10-08-home-grid-rebuild::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>docs/dashboard.ZH.md</Path> => 2026-10-08-home-grid-rebuild::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-16: 保存并应用全局主题与首页组合外观

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-16.md](../evidence/T-16.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/16-named-global-appearance.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 按已确认规则保存theme+home完整命名组合，一键恢复全部窗口外观且不引入按板主题。

**规划时基线：** theme namespace/runtime已经管理所有窗口和编辑器；home ThemeStudio现在只调背景/装饰，无private palette和saved themes。SettingsStore能同时bind多个namespace并共用flush。

**来源：** AC-064, AC-065, AC-066, AC-067；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

home.appearancePresets仅保存白名单theme和home字段，命名唯一，active id独立。apply规范化两个slice后通过各自SettingsHandle.update，现有store合并flush；只有保存成功才反馈已保存，不建立transaction平台。theme/colors仍由theme runtime拥有，home装饰仍所有看板共享；删除active只去快照/marker不改变look。不得把凭证/路径/按钮配置卷入snapshot。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 按已确认规则保存theme+home完整命名组合，一键恢复全部窗口外观且不引入按板主题。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

按已确认规则保存theme+home完整命名组合，一键恢复全部窗口外观且不引入按板主题。

home.appearancePresets仅保存白名单theme和home字段，命名唯一，active id独立。apply规范化两个slice后通过各自SettingsHandle.update，现有store合并flush；只有保存成功才反馈已保存，不建立transaction平台。theme/colors仍由theme runtime拥有，home装饰仍所有看板共享；删除active只去快照/marker不改变look。不得把凭证/路径/按钮配置卷入snapshot。

## 5. 实现契约

- **入口、输入输出、状态和错误：** home.appearancePresets仅保存白名单theme和home字段，命名唯一，active id独立。apply规范化两个slice后通过各自SettingsHandle.update，现有store合并flush；只有保存成功才反馈已保存，不建立transaction平台。theme/colors仍由theme runtime拥有，home装饰仍所有看板共享；删除active只去快照/marker不改变look。不得把凭证/路径/按钮配置卷入snapshot。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 定义白名单snapshot与home namespace字段，复用ThemeSettings公开类型/normalize而非新颜色规则。
2. 实现save/validate/apply/delete服务，通过theme/home已有handles和共同flush保持所有权。
3. 在现外观入口以Preact提供命名/列表/应用/删除，重名提示与active状态明确。
4. 接现ThemeRuntime/all-board refresh，处理设置保存错误而不伪称成功。
5. 验证全窗/编辑器/重启与旧preset对比度，更新双语数据说明。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 设置逻辑 | pnpm test | 在home appearance服务相邻新增白名单/同名/delete-active用例，沿用src/theme/settings.test.ts和shared/settings/store.test.ts先例 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> |
| 真实 | 主窗口+popout+两板，自定义theme/home后保存，改值，再应用和重启 | 所有用户可见外观恢复，主题影响Markdown/编辑器，无per-board私有颜色 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> |
| 错误 | 受控settings persistence失败后应用组合并查看状态，再显式重试 | 显示未保存错误，重试走原store；不新增恢复体系 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> |
| 规范 | pnpm test:architecture && pnpm test:docs && pnpm run check:bundle | 跨zone合法，双语同步，lazy面板预算保持 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 保存/重名/应用/删除当前、theme+home双恢复、popout与重启、保存错误。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

新增named snapshot不改既有live schema含义；删除快照不恢复旧值。apply前用户可另存当前look，失败保留store真实pending/error状态并允许现有重试；不假设两次namespace update是额外事务。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-064**：既有theme全部字段和home允许字段共同恢复，未包含看板路径/凭证/设备设置
- [ ] **AC-065**：全局theme更新编辑器与全部窗口，home装饰更新全部看板，无per-board palette
- [ ] **AC-066**：重名反馈不覆盖；删除只删快照/active标记，当前外观不改变
- [ ] **AC-067**：显示真实保存错误，不称成功；两个namespace仍由原store拥有，可正常显式重试，无新恢复系统
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
