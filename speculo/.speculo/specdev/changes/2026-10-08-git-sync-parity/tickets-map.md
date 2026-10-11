---
schema_version: 3
plan_contract_version: 1
plan_revision: 2
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-git-sync-parity"
status: "ready"
---

# Tickets Map: Git 同步对照补齐、仓库边界与失败恢复

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 4 票、11 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/goal-plan.md</Path>

## 1. 目标与拆分策略

在已有同步模块上完成wta参考的逐项差异核销，补clone引导、严格vault边界和推送目标保护，验证手动/自动/冲突恢复完整闭环。

### 总体实施背景

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

继续settings命名空间（策略vault作用域、Git路径/repo路径device作用域）、.git/nand-sync.json时钟。扩展只读repo范围/push target结果，不将账号密钥写vault配置。clone桌面宿主端口使用argv非shell串接；URL认证交系统Git，拒绝含嵌入凭据URL落日志。无用户格式迁移；默认ignore只在明确初始化/引导步骤展示并写，已有内容不无声改。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |
| T-01, T-02, T-03, T-04 | <Path>.agents/skills/ui/SKILL.md</Path> | 页面/组件/样式/交互 | Map后、Ticket前 | 三栏、tokens、焦点与真实宿主 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ticket/01-vault-index-boundary.md</Path> | vault处于更大repo时任何NAND提交都不带入其它项目暂存。 stage/unstage/discard/markResolved也不越出vault边界。 | — | deep | high | yes | Lead | AC-004, AC-005 | G-T-01 | ready |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ticket/02-safe-clone-onboarding.md</Path> | 新设备能安全克隆并获得打开库引导。 | — | deep | high | yes | Lead | AC-002, AC-003 | G-T-02 | ready |
| T-03 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ticket/03-push-target-squash.md</Path> | 高级同步设置不会改写不应改的历史，失败可明确恢复。 | — | deep | high | yes | Lead | AC-006, AC-010 | G-T-03 | ready |
| T-04 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ticket/04-sync-parity-and-recovery.md</Path> | 每个同步能力都有实现/差异与验收，不把已有代码当作全平台已验证。 | T-01, T-02, T-03 | standard | medium | yes | Lead | AC-001, AC-007, AC-008, AC-009, AC-011 | G-T-04 | ready |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- ROOT
T-03 <- ROOT
T-04 <- T-01, T-02, T-03
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-04 | reference-analysis对照与实际文件 | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-02 | SyncService+真实Git宿主 | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-02 | desktop clone与bare remote | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-01 | real Git index/commit tree | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-01 | test/sync/git-flow.test.ts | covered | 每条必须有真实Evidence；无deferred |
| AC-006 | T-03 | 真实bare两副本 | covered | 每条必须有真实Evidence；无deferred |
| AC-007 | T-04 | 两副本+宿主冲突入口 | covered | 每条必须有真实Evidence；无deferred |
| AC-008 | T-04 | 真实失败fixture与凭据宿主 | covered | 每条必须有真实Evidence；无deferred |
| AC-009 | T-04 | automatics/queue+真实host | covered | 每条必须有真实Evidence；无deferred |
| AC-010 | T-03 | 真实Git图与index | covered | 每条必须有真实Evidence；无deferred |
| AC-011 | T-04 | 真实host+git-flow与双语文档 | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- 父repo范围问题在代码层真实存在风险，须用真实index哨兵验证而非只mock列表。
- 真实凭据、SSH agent及远端保护验证需要隔离账号环境；不可因本地bare通过宣称已测外网。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
