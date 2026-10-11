---
schema_version: 3
plan_contract_version: 1
plan_revision: 3
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-terminal-reliability"
status: "completed"
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Tickets Map: 终端 helper 可安装性、错误反馈与句柄隔离

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 2 票、5 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/goal-plan.md</Path>

## 1. 目标与拆分策略

确保新安装真实下载校验后可打开Shell/Agent，并区分未发布资产与网络错误；Unix helper启动时不继承渲染进程无关句柄。

### 总体实施背景

当前0.0.1-alpha.1 Release已有五平台helper和校验和；旧1.0.0背景不再成立。BinaryError含message但controller映射为笼统http文案；main.rs尚无继承FD清理。

BinaryError扩展结构化HTTP状态与规范化原始资产URL，controller与双语文案消费；不更改协议3或stamp格式。Unix代码限定平台cfg，Linux close_range与明确兼容路径；macOS用可验证的closefrom/范围接口择一，具体平台方法是可逆实现细节。不得遍历关闭已开PTY。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |
| T-01 | <Path>.agents/skills/ui/SKILL.md</Path> | 页面/组件/样式/交互 | Map后、Ticket前 | 三栏、tokens、焦点与真实宿主 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ticket/01-download-diagnostics.md</Path> | 全新用户能安装，不能安装时获得准确失败原因。 | — | standard | medium | yes | Lead | AC-001, AC-002, AC-003 | G-T-01 | done |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ticket/02-unix-inherited-fds.md</Path> | helper不再持有Obsidian无关IPC/共享内存，并保持终端会话正常。 | — | deep | high | yes | Lead | AC-004, AC-005 | G-T-02 | done |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- ROOT
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | ensureHelper+真实fresh宿主 | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-01 | BinaryError/controller/i18n | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-01 | binary.test/release资产检查 | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-02 | native stdio集成+proc fd观察 | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-02 | native tests/五平台CI/verify-pty-helper | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- 真实下载验收不能设置NAND_PTY_BINARY，否则掩盖#135。
- 仅设CLOEXEC不能移除helper自己持有的资源，不能当作#143完整修复。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
