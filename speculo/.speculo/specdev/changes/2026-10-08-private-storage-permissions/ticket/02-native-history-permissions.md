---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/tickets-map.md</Path>","T-02 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"}]}]
resource_claims: ["nand:private-storage-permissions:native-history-permissions","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-private-storage-permissions"
id: "T-02"
title: "覆盖原生历史索引和SQLite旁文件权限"
status: "ready"
kind: "bug"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: []
contract_ids: ["AC-005"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>native/pty-server/src/agent_data.rs</Path>","<Path>native/pty-server/src/data.rs</Path>","<Path>native/pty-server/tests/stdio.rs</Path>"]
writable_paths: ["<Path>native/pty-server/src/agent_data.rs</Path>","<Path>native/pty-server/src/data.rs</Path>","<Path>native/pty-server/tests/stdio.rs</Path>","<Path>src/modules/agent/platform/desktop/server/native-history.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-private-storage-permissions::T-02（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-private-storage-permissions::T-02（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-02: 覆盖原生历史索引和SQLite旁文件权限

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-02.md](../evidence/T-02.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ticket/02-native-history-permissions.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 新建和重建历史索引始终遵守私有存储权限。

**规划时基线：** native直接fs创建目录和Connection::open不能依赖JS后置补救。

**来源：** AC-005；issue #144；<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

Unix目录和数据库/必要旁文件在创建链受限，Windows不套POSIX；限定索引所属.nand路径，不能收紧原生CLI历史源目录。从.nand根到索引父路径逐级lstat，拒绝根/中间symlink，即使canonical目标仍在vault内；现有仅检查留在vault内的ancestor保护不足。使用Rust自己的权限边界，不消费JS端口，故与T-01无功能前置边，执行资源仍串行。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 新建和重建历史索引始终遵守私有存储权限。 | 现有TextStorage/JsonStore/DurableState冲突与恢复、native历史索引 | 普通笔记权限、加密、ACL迁移、远程Git历史清除、WindowsPOSIX模拟 |

## 4. 要构建什么

新建和重建历史索引始终遵守私有存储权限。

Unix目录和数据库/必要旁文件在创建链受限，Windows不套POSIX；限定索引所属.nand路径，不能收紧原生CLI历史源目录。从.nand根到索引父路径逐级lstat，拒绝根/中间symlink，即使canonical目标仍在vault内；现有仅检查留在vault内的ancestor保护不足。使用Rust自己的权限边界，不消费JS端口，故与T-01无功能前置边，执行资源仍串行。

## 5. 实现契约

- **入口、输入输出、状态和错误：** Unix目录和数据库/必要旁文件在创建链受限，Windows不套POSIX；限定索引所属.nand路径，不能收紧原生CLI历史源目录。从.nand根到索引父路径逐级lstat，拒绝根/中间symlink，即使canonical目标仍在vault内；现有仅检查留在vault内的ancestor保护不足。使用Rust自己的权限边界，不消费JS端口，故与T-01无功能前置边，执行资源仍串行。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 核对索引创建/重建/WAL模式和目标校验，记录实际旁文件行为。
2. 对Unix创建步骤应用限制mode，保持读取CLI源数据不变。
3. 以真实native请求写入/查询/重建索引检查mode及内容，并回归Windowscfg。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | pnpm run check:native; pnpm exec vitest run src/modules/agent/platform/desktop/server/native-history.test.ts | 历史请求与真实fs mode正确 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path> |
| 失败 | 分别令.nand根与中间目录symlink指向库内普通笔记或库外哨兵，发送真实索引请求 | 拒绝创建/收紧目标，普通笔记和源CLI历史权限/内容不变 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path> |
| 回归 | 重建SQLite、启动/关闭helper并核验可能存在的-wal/-shm | 600及内容不丢失 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** not-required: 可由真实系统Git/文件系统或子进程集成验证核心行为；需要的宿主观察另列Gate。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无schema迁移；旧索引可重建但不得借权限失败删除唯一标签/会话记录。权限保持收紧，回退代码不扩大权限。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-005**：目录0700数据库和旁文件0600，历史与恢复正常
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
