---
schema_version: 1
artifact: "implementation-plan"
change: "2026-09-28-open-issues-remediation-goal"
status: "in_progress"
source_map_revision: 3
orchestration: "lead-directed"
lead: "codex-issue-planning"
implementation_agent_limit: 1
integration_attempt_limit: 3
ticket_workspace_policy: "current"
integration_gate: "direct-parent"
ready_for_execution: true
---

# Implementation Plan: 联合串行修复计划

## 1. Outcome and Authority

Outcome：9条open issue中的确认残留与用户确认的自动化开关全部满足子Spec，旧已修行为无退化，公开发行终端与插件匹配。成功需要逐票实现Evidence与聚合验收；9条仍open不等于9条全部旧描述仍真，16张ready票不等于授权执行。

用户范围：全量读取远程未关闭issue并详实诊断/规划；工作区答复“当前工作区，票据严格串行”；#36明确新增开关，关闭停止执行、保留数据通知。父Map只投影，子工件与原始Source保持权威。

## 2. Ready Frontier and Waves

当前仅plan，授权门关闭，所以可执行frontier为空。结构ready候选以控制器从子票动态计算；下面是满足依赖后的推荐串行队列，每个Wave只有1票：

1. `2026-09-28-issue-37-terminal-release::T-01`
2. `2026-09-28-issue-38-agent-preflight::T-01`
3. `2026-09-28-issue-39-widget-source::T-01`
4. `2026-09-28-issue-30-live-language-refresh::T-01`
5. `2026-09-28-issue-30-live-language-refresh::T-02`
6. `2026-09-28-issue-32-product-copy::T-01`
7. `2026-09-28-issue-31-contacts-polish::T-01`
8. `2026-09-28-issue-31-contacts-polish::T-02`
9. `2026-09-28-issue-40-visible-export::T-01`
10. `2026-09-28-issue-41-workbench-usability::T-01`
11. `2026-09-28-issue-41-workbench-usability::T-02`
12. `2026-09-28-issue-36-automation-presentation::T-01`
13. `2026-09-28-issue-36-automation-presentation::T-02`
14. `2026-09-28-issue-36-automation-presentation::T-03`
15. `2026-09-28-issue-36-automation-presentation::T-04`
16. `2026-09-28-issue-36-automation-presentation::T-05`

优先级依据：#37是默认安装P1，先准备独立配套Release，不能被低风险文案绑住；#38/#39修功能与真实错误；语言、档案、导出和工作台随后；#36结构化呈现及开关放在所需错误/导航接缝稳定后。#37的发布动作若缺授权只暂停该动作，Lead可继续其它已授权票；不得把未发布票标done。

## 3. Workspace and Dispatch Contract

current/direct-parent，唯一Lead及实现writer codex-issue-planning，implementation_agent_limit=1（config上限3，未派子agent），integration_attempt_limit=3。用户未要求代理并行，不能自行委派。所有子Goal策略已一致，无Ticket worktree。前一票结果经Lead验收才交接公共文件与生成main.js。

每票先Map→项目Skill→Ticket→上游事实；读取绑定字节摘要，漂移则由owner审查。运行包只允许当前票writable_paths；当前权限模型若禁止某个必要路径（例如技能目录），该票在执行前登记具体受限路径，不绕过或移动源，独立分支可继续。

授权：本地分析/计划已授权；实现、implementation commit、direct-parent推进、push/tag/release、评论/关闭issue、archive均未授权。run入口根据当时用户指令核对，文件里的权限文字不能授予权限。

## 4. Repository Integration Queue

repository=NAMEWTA/nand，branch=main（运行前重读），一个integration队列；基线及代码摘要见子Evidence。每票记录parent-before、implementation、result SHA及命令/E2E。当前零commit、零candidate、零dispatch、零locks。不能重置/清理他人工作；当前分支失败时停止启动后继，保留失败修改并按授权纠正。

## 5. Gates and Aggregate Verification

G0：真实实施/提交授权、dirty归属、Skill/源摘要、E2E环境与路径权限。
G1：当前票精确红灯/正确新增功能合同；历史红灯必须重新与当前源码核对。
G2：逐票所需测试、build/lint、架构、direct-parent与真实宿主验收，禁止用PROBE_CONTROL做修复后证据。
G3：聚合 automation、contacts、terminal-agent、settings-nav、issue-regressions、panel-composition、architecture、mobile-stability、build/lint；原生日志/档案/游标/通知回执完整性；双语言、关闭开关后重启和恢复的跨域流程。
G4：#37独立发布门：同提交五平台资产、摘要和插件包，具体发布授权后从公开Release默认下载测试首次PTY/历史；本地编译对照不替代此门。
G5：36条AC逐项对账，各member完成其Goal，父聚合Evidence完整；没有active锁/未闭合动作才能completed。Issue回写单独走T-triage，不能自动关闭。

## 6. Conflict, Drift and Recovery

子Ticket/Spec/Skill/HEAD变化使旧派单失效，先更新真正owner，再递增父revision并重算图；不得从父投影反向覆盖子源。共享行为冲突返回Spec，路径冲突持有当前唯一writer并暂停相交闭包。停止/恢复依靠真实Evidence而非会话记忆。当前workspace不适用candidate机制。

本次网络/权限环境途中改变；已有公开资产实测日志在改变前捕获，后续若子进程启动或下载受限只标环境失败，不重写先前事实，也不声称当前环境可跑完整E2E。无当前Obsidian实机证明的视觉项保留实施Gate。发布不可回写旧tag；通知可选字段向后读取，旧自由文本不猜测转换；关模块不能删历史。

## 7. Progress and Decisions

所有子Spec/16张票已ready，父Map ready；本父Plan使用schema允许的blocked/ready_for_execution=false，准确表示“规划已完成，运行门尚未打开”，不表示本次分析未交付。当前work保留specdev/goal-plan作为父恢复键。下一次用户要求实施时从父tickets-map进入P run，并先做G0。

每个child继续拥有自身状态、诊断和验收；本父不得越过Gate。最终聚合Evidence计划写在本父evidence/implementation-orchestration.md，现在不存在，不能引用为已通过。

## 8. 实施授权更新（2026-09-28）

本次用户要求“完整实现…所有 ticket…完成实施”，取代上述 plan-only 的本地执行限制。当前串行实施和必要本地提交已授权；不改写旧 tag，不发送 issue 消息。#37 先准备本地可审阅候选，公开发布与真实宿主验收仍保持独立 gate。历史的 blocked/frontier 快照不作为拒绝本次本地执行的理由。逐票真实结果见 evidence/implementation-orchestration.md。
