---
schema_version: 3
plan_contract_version: 1
plan_revision: 3
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-workbench-regressions"
status: "completed"
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Tickets Map: 工作台导航、常规设置与图标语言回归

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 3 票、5 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/goal-plan.md</Path>

## 1. 目标与拆分策略

修复medium覆盖层吞rail点击、模块图标位置错误和实时切换语言后的原生下拉裁切。

### 总体实施背景

shell scrim inset0覆盖rail；home模块图标CSS仅命中原生设置祖先；bindLocalizedOptions只改选项DOM未刷新原生测量。根因来自源码与issue宿主观察，待本票定向重现。

无公共接口/数据格式/迁移。若本地化需要持有控件刷新函数，以控件/页面生命周期注册释放；不把原生私有测量DOM当公共合同。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |
| T-01, T-02, T-03 | <Path>.agents/skills/ui/SKILL.md</Path> | 页面/组件/样式/交互 | Map后、Ticket前 | 三栏、tokens、焦点与真实宿主 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/ticket/01-overlay-rail-navigation.md</Path> | 覆盖层打开时用户可一次切换模块，键盘与指针一致。 | — | standard | medium | yes | Lead | AC-001, AC-002 | G-T-01 | done |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/ticket/02-settings-module-icons.md</Path> | 模块图标与开关在两个宿主都可辨识。 | — | lite | medium | yes | Lead | AC-003 | G-T-02 | done |
| T-03 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/ticket/03-localized-dropdown-sizing.md</Path> | 实时语言切换后原生下拉长标签完整，当前选值不变。 | — | standard | medium | yes | Lead | AC-004, AC-005 | G-T-03 | done |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- ROOT
T-03 <- ROOT
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | Shell selectRail +真实点击 | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-01 | 真实Obsidian主窗/popout | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-02 | Setting DOM+截图 | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-03 | 真实Dropdown与语言切换 | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-03 | localized-dom及宿主回归 | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- medium视觉可点击但dialog focus trap排除rail会留下键盘bug；同时检查焦点范围。
- Dropdown.setValue是否真正重测须真实宿主验证，不凭stub成功结论。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
