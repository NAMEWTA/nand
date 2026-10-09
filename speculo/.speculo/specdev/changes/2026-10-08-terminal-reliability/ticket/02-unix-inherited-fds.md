---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path>","T-02 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]}]
resource_claims: ["nand:terminal-reliability:unix-inherited-fds","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-terminal-reliability"
id: "T-02"
title: "在 helper 最早入口关闭继承的Unix描述符"
status: "ready"
kind: "bug"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: []
contract_ids: ["AC-004","AC-005"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>native/pty-server/src/main.rs</Path>","<Path>native/pty-server/src/inherited_fds.rs</Path>","<Path>native/pty-server/tests/stdio.rs</Path>"]
writable_paths: ["<Path>native/pty-server/src/main.rs</Path>","<Path>native/pty-server/src/inherited_fds.rs</Path>","<Path>native/pty-server/tests/stdio.rs</Path>","<Path>native/pty-server/Cargo.toml</Path>","<Path>native/pty-server/Cargo.lock</Path>","<Path>.github/workflows/terminal-build.yml</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-terminal-reliability::T-02（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-terminal-reliability::T-02（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-02: 在 helper 最早入口关闭继承的Unix描述符

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ticket/02-unix-inherited-fds.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** helper不再持有Obsidian无关IPC/共享内存，并保持终端会话正常。

**当前事实：** main先建立资源，无fd隔离。

**来源：** AC-004, AC-005；issue #135, #143；<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

清理在任何线程和资源建立之前；0/1/2保持，Unixcfg隔离；清理失败输出stderr诊断，不使用半清理成功声明。按已支持OS选简单明确实现，Linux旧内核兼容必须有真实入口验证；Windows编译不引入POSIX依赖。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| helper不再持有Obsidian无关IPC/共享内存，并保持终端会话正常。 | 现有ensureHelper校验/原子替换、stdio协议3、五平台CI与exit清理 | 发布新版本/推送tag/下载旧helper兜底、GPL终端代码、把所有进程fd≥3都关闭 |

## 4. 要构建什么

helper不再持有Obsidian无关IPC/共享内存，并保持终端会话正常。

清理在任何线程和资源建立之前；0/1/2保持，Unixcfg隔离；清理失败输出stderr诊断，不使用半清理成功声明。按已支持OS选简单明确实现，Linux旧内核兼容必须有真实入口验证；Windows编译不引入POSIX依赖。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 清理在任何线程和资源建立之前；0/1/2保持，Unixcfg隔离；清理失败输出stderr诊断，不使用半清理成功声明。按已支持OS选简单明确实现，Linux旧内核兼容必须有真实入口验证；Windows编译不引入POSIX依赖。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 构造父进程额外文件/socket继承哨兵，确认helper可见以固定缺陷。
2. 实现Unix最早入口清理并在main第一步调用，选择许可兼容依赖。
3. 验证清理后新PTY/历史/stdio工作，Linux proc中无父资源，macOS等价检查。
4. 运行native用例与平台CI，回归shutdown/stdin关闭与shell子fd。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | pnpm run check:native; node scripts/verify-pty-helper.mjs native/pty-server/target/release/nand-pty | stdio/PTY/退出通过；后二进制需实际构建 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path> |
| 失败 | 父传入非CLOEXEC哨兵与大量fd，Linux检查/proc/helper/fd | 父哨兵全无，stdio保留 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path> |
| 回归 | 真实Obsidian启动/重启两次、macOS/Windows CI | Chromium资源未继承，shell/平台无退化 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** not-required: 可由真实系统Git/文件系统或子进程集成验证核心行为；需要的宿主观察另列Gate。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无用户数据迁移；可回退入口清理但不能把缺口标完成。监控启动失败/握手超时，停止下游终端验收。原有Windows job规则保留，不全局改Obsidian umask。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-004**：stdio可用；父哨兵消失；只剩helper自己创建资源，真实宿主无Chromium共用IPC
- [ ] **AC-005**：PTY工作、退出无孤儿；macOS路径被验证、Windows不误用fd处理
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
