---
schema_version: 3
plan_contract_version: 1
plan_revision: 2
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-private-storage-permissions"
status: "ready"
---

# Tickets Map: NAND 私有目录和文件的最小POSIX权限

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/goal-plan.md</Path>

## 1. 目标与拆分策略

收紧桌面POSIX .nand配置/运行数据的目录与文件权限，兼容旧库、克隆库与原有读写。

### 总体实施背景

JsonStore/DurableState/adapter写入按umask，native SQLite同样会创建文件；浏览器用户数据目录已显式0700/0600，库内目前不一致。

新增desktop权限适配在src/host/desktop下，Obsidian adapter装配在host/obsidian或app；shared只依赖纯接口，不导入fs/obsidian。覆盖配置、浏览、Agent标签/SQLite与-wal/-shm、automation、notification、comments/icons、recovery/cache，按真实owner枚举写入口，不能只chmod一次已有文件遗漏新文件。native直接创建索引也遵守限制，不全局修改Obsidian进程umask。 所有新增news/browser历史writer消费该host私有storage端口；后续票不复制独立chmod实现。根和每级中间目录以lstat识别symlink，目标即使仍在vault内也不能跟随至普通笔记。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ticket/01-posix-private-storage.md</Path> | 桌面首次/升级使用.nand即获得最小权限，用户读写行为保持。 | — | deep | high | yes | Lead | AC-001, AC-002, AC-003, AC-004, AC-006 | G-T-01 | ready |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ticket/02-native-history-permissions.md</Path> | 新建和重建历史索引始终遵守私有存储权限。 | — | deep | high | yes | Lead | AC-005 | G-T-02 | ready |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- ROOT
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | 真实fs stat | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-01 | 旧库fixture真实fs | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-01 | lstat边界与拒绝权限fixture | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-01 | platform guard+宿主 | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-02 | native history+fs | covered | 每条必须有真实Evidence；无deferred |
| AC-006 | T-01 | docs核对 | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- 一次根chmod可隐藏旧文件但不满足新文件0600合同，需检查全写链。
- SQLite旁文件由native创建，必须跨语言处理；禁止移动代码导入Node。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
