---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"add18e61df97494df0d6f0ab45a5920bc0132779e6a33d53bc6c41ff1b701aab","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/editor-comments.md</Path>","sha256":"4230b3139db980ff545379e1aeebb9a9c837e8b604da814ad2f3765413f67003","when":"本票命中结构/数据或验证"}]}]
resource_claims: ["nand:private-storage-permissions:posix-private-storage","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-private-storage-permissions"
id: "T-01"
title: "在桌面存储边界统一创建和升级权限"
status: "done"
kind: "bug"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: []
contract_ids: ["AC-001","AC-002","AC-003","AC-004","AC-006"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/host/desktop/private-storage.ts</Path>","<Path>src/host/desktop/private-storage.test.ts</Path>","<Path>src/host/obsidian/storage/</Path>"]
writable_paths: ["<Path>src/host/desktop/private-storage.ts</Path>","<Path>src/host/desktop/private-storage.test.ts</Path>","<Path>src/host/obsidian/storage/</Path>","<Path>src/app/settings/runtime.ts</Path>","<Path>src/app/main.ts</Path>","<Path>src/shared/storage/ports.ts</Path>","<Path>src/shared/json-store.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/automations/module.ts</Path>","<Path>src/modules/notifications/module.ts</Path>","<Path>docs/data.md</Path>","<Path>docs/data.ZH.md</Path>","<Path>docs/privacy.md</Path>","<Path>docs/privacy.ZH.md</Path>","<Path>src/shared/storage/durable-state.ts</Path>","<Path>src/host/obsidian/storage/device-id.ts</Path>","<Path>src/modules/browser/platform/store.ts</Path>","<Path>src/modules/agent/platform/history/service.ts</Path>","<Path>src/modules/home/platform/weread/weread-progress-store.ts</Path>","<Path>src/modules/home/platform/board/sync.ts</Path>","<Path>src/modules/icons/platform/persistence/store.ts</Path>","<Path>src/modules/comments/platform/vault-fs.ts</Path>","<Path>src/modules/comments/ui/runtime.ts</Path>","<Path>src/modules/automations/services/runtime.ts</Path>","<Path>src/modules/agent/services/agent-runtime.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-private-storage-permissions::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-private-storage-permissions::T-01（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-01: 在桌面存储边界统一创建和升级权限

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-01.md](../evidence/T-01.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ticket/01-posix-private-storage.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 桌面首次/升级使用.nand即获得最小权限，用户读写行为保持。

**规划时基线：** 创建走adapter无mode；不能把fs放shared。

**来源：** AC-001, AC-002, AC-003, AC-004, AC-006；issue #144；<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

纯存储端口与desktop具体实现分开；初始化root和创建写入以0700/0600，既有管理路径一次修复；symlink不跟随；平台和adapter双守卫；修复失败非致命但数据write失败继续由原保存状态报告。 由host提供受限TextStorage端口，在确切writer构造处注入；禁止monkeypatch app.vault.adapter。浏览store、agent history元数据、home Weread缓存/board恢复、icons备份及comments sidecar均覆盖，普通Markdown仍保留原adapter事件语义。 automations runtime JsonStore和agent-runtime运行记录直接writer同样从构造注入私有端口，不能只改module而遗漏内部adapter。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 桌面首次/升级使用.nand即获得最小权限，用户读写行为保持。 | 现有TextStorage/JsonStore/DurableState冲突与恢复、native历史索引 | 普通笔记权限、加密、ACL迁移、远程Git历史清除、WindowsPOSIX模拟 |

## 4. 要构建什么

桌面首次/升级使用.nand即获得最小权限，用户读写行为保持。

纯存储端口与desktop具体实现分开；初始化root和创建写入以0700/0600，既有管理路径一次修复；symlink不跟随；平台和adapter双守卫；修复失败非致命但数据write失败继续由原保存状态报告。 由host提供受限TextStorage端口，在确切writer构造处注入；禁止monkeypatch app.vault.adapter。浏览store、agent history元数据、home Weread缓存/board恢复、icons备份及comments sidecar均覆盖，普通Markdown仍保留原adapter事件语义。 automations runtime JsonStore和agent-runtime运行记录直接writer同样从构造注入私有端口，不能只改module而遗漏内部adapter。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 纯存储端口与desktop具体实现分开；初始化root和创建写入以0700/0600，既有管理路径一次修复；symlink不跟随；平台和adapter双守卫；修复失败非致命但数据write失败继续由原保存状态报告。 由host提供受限TextStorage端口，在确切writer构造处注入；禁止monkeypatch app.vault.adapter。浏览store、agent history元数据、home Weread缓存/board恢复、icons备份及comments sidecar均覆盖，普通Markdown仍保留原adapter事件语义。 automations runtime JsonStore和agent-runtime运行记录直接writer同样从构造注入私有端口，不能只改module而遗漏内部adapter。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 扫描.nand所有writer和native边界，列唯一权限适配入口与需注入者。
2. 实现desktop路径约束+安全创建+既有权限修复，保留adapter数据写语义与host事件。
3. 接入配置及各runtime writer，shared仅端口；同步双语数据/隐私说明。
4. 以umask022 fresh/upgrade/clone/symlink/拒绝权限验证，运行架构与存储定向回归。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | 真实临时vault在umask022创建各类JSON与目录，stat并比较内容digest | 700/600与字节稳定 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path> |
| 失败 | 权限拒绝、symlink目标哨兵、只读adapter场景 | 目标不越界、不删数据、失败可见 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path> |
| 回归 | pnpm exec vitest run src/shared/storage src/host src/shared/settings; pnpm test:architecture | 无Node导入shared与平台退化 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** not-required: 可由真实系统Git/文件系统或子进程集成验证核心行为；需要的宿主观察另列Gate。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

先扩展端口/适配再迁移writer，不改文件内容/主键。修复无法完成不放宽mode。回滚代码保留已收紧权限，不自动chmod回755。没有生产数据破坏性迁移。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-001**：所有创建.nand目录0700文件0600，普通笔记mode不变
- [ ] **AC-002**：.nand根/管理子路径收紧，字节相同且无重复大量扫描
- [ ] **AC-003**：不跟随symlink创建或chmod其目标，普通笔记/外部哨兵不变；权限修复失败非致命，不删除数据
- [ ] **AC-004**：无POSIX调用且读写同步保持
- [ ] **AC-006**：说明0700/0600与clone重施，明确非加密不变更笔记
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
