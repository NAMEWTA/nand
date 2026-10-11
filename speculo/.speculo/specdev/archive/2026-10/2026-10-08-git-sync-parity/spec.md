---
schema_version: 3
artifact: "spec"
change: "2026-10-08-git-sync-parity"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Spec: Git 同步对照补齐、仓库边界与失败恢复

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 4 票、11 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

在已有同步模块上完成wta参考的逐项差异核销，补clone引导、严格vault边界和推送目标保护，验证手动/自动/冲突恢复完整闭环。

### 规划时基线

当前有sync module完整实现、真实Git测试及文档，旧src/core/sync占位事实过时。尚无clone向导；GitRepo.status/stagedPaths/commit使用整个index，vault位于父repo时须补外部暂存保护；squash按upstream而参考按pushTarget，分离目标需显式处理。

### 目标用户与场景

- 作为多设备笔记用户，我知道每次提交包含哪些文件，并能可靠同步。
- 作为新设备用户，我能按清晰引导接入远端而不覆盖现有库。
- 作为遇到冲突的用户，我能保留双方内容、人工解决并明确继续或中止。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- 自动reset/force push、mobile Git引擎、子模块管理、完整blame、hunk暂存、通用原始Git控制台

## 2. 解决方案与外部行为

接入依次检测Git、repo与vault关系、HEAD/作者/remote/upstream，明确新库/已有库/detached/无upstream。clone仅明确空新目录，先展示URL（脱敏）和目标；成功后引导打开该目录为库，失败保留可识别的本次临时目标，不删除用户内容。

Commit smart/staged/all与sync-all/staged-sync行为分明。任何提交前检查整个index的边界；库外暂存存在就停止并提示，不把它偷偷提交/unstage。stage-all只纳入vault范围，已有ignore保持，新引导展示设备私有目录影响；已tracked文件不能靠新ignore自动移除。

同步按commit→按设置pull→push，pull失败或conflict不push；没有工作区变化仍发送待推送提交、处理remote新提交。merge/rebase冲突待人工，查看diff、文本上下双方/基底、二进制保留显式终端选择或中止入口。继续/中止反馈真实repo状态。

手动/自动同队列串行、重复触发合并、失败继续可恢复、编辑后延迟、独立间隔和跨会话时钟。外部lock不删；卸载取消进程和计时器。身份/认证/权限/拒绝/离线/timeout单独反馈，部分成功逐步呈现。

squash显式开关默认关，只有实际推送目标的远端已知且是祖先、至少两条未推送无merge、未被其它引用、index无未提交暂存时允许；pushRemote/upstream不一致须明确目标一致性再执行，不能对未知push目标改历史。失败可用保存的原HEAD恢复，保留index/worktree，绝不force push。

全部index修改入口执行vault边界约束，unstage-all仅处理vault内pathspec，包含无HEAD情况；库外暂存不自动清理。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为多设备笔记用户，我知道每次提交包含哪些文件，并能可靠同步。
- **US-002**：作为新设备用户，我能按清晰引导接入远端而不覆盖现有库。
- **US-003**：作为遇到冲突的用户，我能保留双方内容、人工解决并明确继续或中止。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 参考固定bde2d06与当前HEAD | 读代码并完成对照 | 命令/manager/自动/设置/UI/冲突/认证/扩展全部逐项追踪到NAND与证据 | reference-analysis对照与实际文件 |
| AC-002 | Git缺失、新repo、无作者/remote/upstream、detached | 接入/初始化/首次同步 | 每种状态有准确下一步，首次push设置upstream仅手动确认 | SyncService+真实Git宿主 |
| AC-003 | 用户选择新空目标、或非空/取消/失败 | clone | 空目标成功且不修改当前库；非空拒绝；失败和取消不删用户数据 | desktop clone与bare remote |
| AC-004 | 父repo含vault外已暂存哨兵及多类文件 | smart/all/staged/sync各模式、stage/unstage-all/discard/markResolved（含unborn及rename） | 不会提交/改动范围外index；阻塞明确；vault内所选内容准确 | real Git index/commit tree |
| AC-005 | 暂存/未暂存混合或无工作区变化但ahead | 不同提交/同步模式 | staged-first和独立auto setting准确；无变更仍push已有提交；重跑不重复commit | test/sync/git-flow.test.ts |
| AC-006 | pull/push开关与merge/rebase | 双方变化同步 | 逐步结果准确，pull失败不push，不自动reset/force | 真实bare两副本 |
| AC-007 | 多种文本/删除重命名/二进制冲突 | pull→查看→手工解决continue或abort | 阻止auto commit/push，双方数据可恢复，UI与repo一致 | 两副本+宿主冲突入口 |
| AC-008 | 断网/timeout/认证/权限/拒绝/index.lock | 同步失败再恢复 | 保留本地编辑与提交，明确失败步骤，不永久busy不无限重试 | 真实失败fixture与凭据宿主 |
| AC-009 | 手动/自动同时触发、短会话/持续编辑 | 重复运行/暂停/设置变化/卸载 | 仓库同一writer、时钟正确、任务无泄漏，状态收敛 | automatics/queue+真实host |
| AC-010 | 不同push target或staged/tag/merge/diverged/中途commit失败 | 开启squash后push | 只改确定未推送历史；不满足则说明跳过/阻止，无暂存丢失、可恢复原HEAD | 真实Git图与index |
| AC-011 | 中英、空格中文路径、千文件及20MB附件 | 设置/命令/同步/冲突 | 宿主正确刷新，实耗时/平台/认证限制如实报告，文档来源一致 | 真实host+git-flow与双语文档 |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- 参考完整调用链和能力表、手动/自动同步、错误/冲突恢复
- 新增安全clone向导、vault范围/预暂存保护、push-target/squash核验
- 双语设置/命令/文档及真实Git与宿主证据

### REUSE

- sync/core/flow、GitRunner、queue、automatics、编辑器冲突扩展、状态与history/diff

### OUT

- **OOS-001**：自动reset/force push、mobile Git引擎、子模块管理、完整blame、hunk暂存、通用原始Git控制台

## 6. 已锁定实现约束

- **DEC-001**：复用credential/SSH，不引入移动isomorphic-git；移动端明确不支持，子模块/blame/行级暂存列能力差异。 来源：LOG-001；#134逐项说明允许+当前ADR0012。
- **DEC-002**：merge/rebase显式选；不提供reset或自动force-push；squash默认关，按实际目标核实只改未推送历史。 来源：LOG-002；#134。
- **DEC-003**：提供用户主动选择的新空目录clone向导，不向当前非空vault写clone，也不自动切换库。 来源：LOG-003；#134接入要求。
- **DEC-004**：父repo中有范围外暂存时停止提交并提示用户处理，不移动/丢弃这些暂存；不凭UI过滤假装安全。 来源：LOG-004；#134不得意外提交库外文件。
- **DEC-005**：push和squash使用系统Git解析的实际push远端/ref；不同pull upstream可用，无法唯一解析时不改写历史。所有index修改含unstage-all严格限制vault。 来源：LOG-005；#134安全同步要求、固定参考pushTarget实现与当前core源码事实。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

继续settings命名空间（策略vault作用域、Git路径/repo路径device作用域）、.git/nand-sync.json时钟。扩展只读repo范围/push target结果，不将账号密钥写vault配置。clone桌面宿主端口使用argv非shell串接；URL认证交系统Git，拒绝含嵌入凭据URL落日志。无用户格式迁移；默认ignore只在明确初始化/引导步骤展示并写，已有内容不无声改。

## 8. 非功能要求

- **NFR-001**：credential/SSH secrets不进设置/日志/可同步文件；仓库外预暂存是硬停止。
- **NFR-002**：中文/空格/通配字符路径按literal处理；千文件和20MB附件记录实耗时，无臆造SLA。
- **NFR-003**：外部index.lock不擅自删，取消/失败保存本地编辑，队列有生命周期。
- **NFR-004**：状态反映Git实际commit图和步骤；对每项参考功能标已实现/补齐/不支持及理由。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-004, AC-005 | pnpm exec vitest run test/sync/git-flow.test.ts src/modules/sync/core/core.test.ts; 父repo预暂存outside.txt，再在vault执行各提交模式; 中文/空格/rename路径+无upstream及已有ignore; 父repo外部staged哨兵，分别在有HEAD/unborn执行unstage-all及包含../外部或跨界rename输入 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-002, AC-003 | 真实bare remote克隆到新的临时空目录; 非空目录、认证缺失、取消、目标期间出现用户文件; pnpm exec vitest run src/modules/sync test/sync/git-flow.test.ts; 真实宿主初始化 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-02.md</Path> |
| T-03所列稳定入口 | 真实host/系统集成或定向单元 | AC-006, AC-010 | pnpm exec vitest run test/sync/git-flow.test.ts; hook拒绝commit、push拒绝、目标不同或远端漂移; staged/tag/merge/diverged组合与pull失败 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-03.md</Path> |
| T-04所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-007, AC-008, AC-009, AC-011 | pnpm exec vitest run src/modules/sync test/sync/git-flow.test.ts; 受控真实宿主断网、credential失败、外部lock及冲突continue/abort; pnpm test:docs; pnpm check:notices; 真实1000文件20MB附件场景 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/evidence/T-04.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- 父repo范围问题在代码层真实存在风险，须用真实index哨兵验证而非只mock列表。
- 真实凭据、SSH agent及远端保护验证需要隔离账号环境；不可因本地bare通过宣称已测外网。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
