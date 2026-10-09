---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:archives-completion:close-parity-evidence","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-archives-completion"
id: "T-01"
title: "核销档案双布局、全文搜索与规模行为"
status: "ready"
kind: "documentation"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: true
risk: "medium"
blocked_by: []
contract_ids: ["AC-001","AC-002","AC-003","AC-004","AC-005","AC-006","AC-007","AC-008"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>docs/contacts.md</Path>","<Path>docs/contacts.ZH.md</Path>","<Path>docs/acceptance/archives-124.md</Path>","<Path>scripts/accept-contacts-scale.ts</Path>"]
writable_paths: ["<Path>docs/contacts.md</Path>","<Path>docs/contacts.ZH.md</Path>","<Path>docs/acceptance/archives-124.md</Path>","<Path>docs/acceptance/archives-124.ZH.md</Path>","<Path>scripts/accept-contacts-scale.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-archives-completion::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-archives-completion::T-01（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-01: 核销档案双布局、全文搜索与规模行为

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/ticket/01-close-parity-evidence.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/evidence/T-01.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 提供逐项可回读的#124能力/宿主/规模验收记录及准确使用说明。

**当前事实：** 主要能力已有，不制造功能重写票或新的测试框架。

**来源：** AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008；issue #124；<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

完整保留上述8项合同；报告当前代码基线、真实结果与截图。验收发现bug时停止关闭本issue，回S/T增加精确修复，不通过改预期掩盖。文档使用中英对照，未测设备显式标记。 复用单一现有规模脚本补齐准确字节数据与指标，不另造benchmark框架；结果记录硬件/版本/样本数，目标未满足则保留失败并回修。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 提供逐项可回读的#124能力/宿主/规模验收记录及准确使用说明。 | ContactsIndex及search-text、parseRecord/patchMarkdown、现有页面/偏好/格式golden | 邮箱同步、AI写作、实体自动合并、附件OCR、语义检索、自定义列、批量编辑、自动旧库迁移 |

## 4. 要构建什么

提供逐项可回读的#124能力/宿主/规模验收记录及准确使用说明。

完整保留上述8项合同；报告当前代码基线、真实结果与截图。验收发现bug时停止关闭本issue，回S/T增加精确修复，不通过改预期掩盖。文档使用中英对照，未测设备显式标记。 复用单一现有规模脚本补齐准确字节数据与指标，不另造benchmark框架；结果记录硬件/版本/样本数，目标未满足则保留失败并回修。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 完整保留上述8项合同；报告当前代码基线、真实结果与截图。验收发现bug时停止关闭本issue，回S/T增加精确修复，不通过改预期掩盖。文档使用中英对照，未测设备显式标记。 复用单一现有规模脚本补齐准确字节数据与指标，不另造benchmark框架；结果记录硬件/版本/样本数，目标未满足则保留失败并回修。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 逐项映射原issue与现有代码/测试，复用91测试结果中档案部分作静态基线。
2. 在一次性库完成两布局/两类型/IME/关联名称/重启和手机或受支持仿真检查，存截图与原始结果。
3. 小幅扩展现有 accept-contacts-scale.ts：按UTF-8实际字节生成0/2KB/20KB正文，100/1000/5000和混合类型矩阵，报告冷启动、热查询P50/P95与heap；真实宿主单独测首屏和列表/卡片切换，不把核心查询时间当渲染时间。
4. 核对AC全覆盖、无功能退化与文件格式变更，再提出关闭资格；本票不远程关闭。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | pnpm exec vitest run src/modules/archives/archives.test.ts; pnpm run accept:contacts-scale | 既有测试通过，性能原始数字可回读 | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/evidence/T-01.md</Path> |
| 失败 | 测试库重复ID、损坏YAML、目录切换及正文HTML文字，操作步骤按AC-005/006 | 部分失败可见、索引不污染、原文不损坏 | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/evidence/T-01.md</Path> |
| 回归 | 真实Obsidian操作AC-001/002/008；pnpm test:docs | 双布局和偏好/焦点保持；文档双语准确 | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/evidence/T-01.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: Lead 在 current-workspace 的一次性测试库验证本票列明的真实宿主路径；不得用构建或stub替代。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无数据迁移；证据发现不达标则不宣布完成，恢复原事实并返回精确修复票。文档提交可回退；不允许空提交或只改票状态。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-001**：集合/顺序/总数与选择页码不变，恢复各布局锚点
- [ ] **AC-002**：新人物list/企业cards；旧缺字段cards；显式偏好优先且按类型记忆
- [ ] **AC-003**：全部命中可解释；基本信息模式排除纯正文；可定位原笔记
- [ ] **AC-004**：身份不合并；列表首邮箱+N详情全部；重复ID不被路径缓存隐藏
- [ ] **AC-005**：新名称可搜旧派生名称无幽灵命中；过时代次不回写
- [ ] **AC-006**：内部身份标记不当正文；文本安全不执行脚本；不相关正文及冲突保护保持
- [ ] **AC-007**：报告P50/P95/渲染/内存与硬件；热查询/切换无磁盘全扫；1000×2KB目标P95≤100ms，压力数据如实
- [ ] **AC-008**：可读可达焦点，空/部分失败状态一致；正文范围明确不含附件
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/evidence/T-01.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/evidence/T-01.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
