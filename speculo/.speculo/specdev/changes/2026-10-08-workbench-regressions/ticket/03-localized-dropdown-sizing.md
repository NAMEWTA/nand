---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/tickets-map.md</Path>","T-03 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/tickets-map.md</Path>","T-03 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:workbench-regressions:localized-dropdown-sizing","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-workbench-regressions"
id: "T-03"
title: "刷新原生下拉的语言与尺寸"
status: "ready"
kind: "bug"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: true
risk: "medium"
blocked_by: []
contract_ids: ["AC-004","AC-005"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/ui/primitives/localized-dom.ts</Path>","<Path>src/modules/icons/ui/settings/sections.ts</Path>","<Path>src/modules/icons/ui/dialogs/rule-picker.ts</Path>"]
writable_paths: ["<Path>src/ui/primitives/localized-dom.ts</Path>","<Path>src/modules/icons/ui/settings/sections.ts</Path>","<Path>src/modules/icons/ui/dialogs/rule-picker.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-workbench-regressions::T-03（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-workbench-regressions::T-03（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-03: 刷新原生下拉的语言与尺寸

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/ticket/03-localized-dropdown-sizing.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 实时语言切换后原生下拉长标签完整，当前选值不变。

**当前事实：** bindLocalizedOptions未触发native尺寸刷新。

**来源：** AC-004, AC-005；issue #138, #139, #140；<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

绑定刷新用公开Dropdown方法或受控重建，更新选项与测量，保留值和回调，解除所有owner销毁监听。禁止遍历隐式第二select和固定px。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 实时语言切换后原生下拉长标签完整，当前选值不变。 | Shell布局与focus恢复、原生Setting/Dropdown、localized-dom绑定 | 重设计模块设置、增加view type、覆盖Obsidian全局控件CSS |

## 4. 要构建什么

实时语言切换后原生下拉长标签完整，当前选值不变。

绑定刷新用公开Dropdown方法或受控重建，更新选项与测量，保留值和回调，解除所有owner销毁监听。禁止遍历隐式第二select和固定px。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 绑定刷新用公开Dropdown方法或受控重建，更新选项与测量，保留值和回调，解除所有owner销毁监听。禁止遍历隐式第二select和固定px。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 以真实Obsidian英文已渲染再切中文重现。
2. 在localized control边界实现可释放刷新，接入图标设置复用者。
3. 验证语言往返、value稳定、onChange无伪触发及重开无泄漏。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | 按#140原步骤，选择仅限移动设备，切回英文 | 标签完整且选值不变 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path> |
| 失败 | 设置页销毁后切语言再重开 | 旧控件不接收回调 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path> |
| 回归 | pnpm test:i18n; pnpm exec vitest run src/ui src/modules/icons | 真实宿主截图+定向回归通过 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: Lead 在 current-workspace 的一次性测试库验证本票列明的真实宿主路径；不得用构建或stub替代。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无数据迁移；回退控件绑定可恢复旧渲染；不静默保存默认值。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-004**：中文完整显示，测量与文字一致，值不变、无额外保存
- [ ] **AC-005**：监听不累积，规则对话框等复用者不退化
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
