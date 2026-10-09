---
schema_version: 1
artifact: "source"
change: "2026-10-08-git-sync-parity"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/134"
captured_at: "2026-10-09T03:57:01.425Z"
content_sha256: "9f2f4fda000cb9a8b1b9fdc791c848e5925e53019d0c67fd4cf6be703972fc64"
remote_state: "open"
close_capability: "supported"
---

# Source: #134 [Git 同步] 全面研读并对照复现 obsidian-git-zh 的同步机制与交互

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T01:36:49Z / 2026-10-08T01:36:49Z
- Labels: []
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:57:01.425Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 9f2f4fda000cb9a8b1b9fdc791c848e5925e53019d0c67fd4cf6be703972fc64。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content

## 目标与明确要求

请认真、全面地仿照、参考和学习 [NAMEWTA/obsidian-git-zh](https://github.com/NAMEWTA/obsidian-git-zh/tree/wta) 中与 **Git 同步相关的实现、操作语义和用户体验**，在 NAND 中落地可靠、可理解、可恢复的 Git 同步能力。

**该仓库应作为本需求的主要实现参考。必须深入阅读实际源码与文档，梳理完整调用链，逐项建立能力对照，再结合 NAND 架构实现。仅浏览 README、模仿界面，或简单串联 `add / commit / pull / push`，均不满足本 issue 的要求。**

重点学习正常流程、设置之间的联动、失败分支、冲突恢复、平台限制与生命周期管理。参考实现中的已知限制和潜在缺陷也应评估，不能把照搬代码当作正确性的证明。复用源码时记录来源、固定参考提交，并保留相应版权与许可声明。

## 已核对的基线

- NAND：`main`，提交 [`02a08024c8738fac4c58488374e7f3213466de40`](https://github.com/NAMEWTA/nand/commit/02a08024c8738fac4c58488374e7f3213466de40)。[`src/core/sync/README.md`](https://github.com/NAMEWTA/nand/blob/02a08024c8738fac4c58488374e7f3213466de40/src/core/sync/README.md) 明确这是预留领域模块，`index.ts` 当前没有实现导出。看板 Markdown 回写位于 `src/platform/obsidian/dashboard`，应与本次 Vault / 数据 Git 同步区分职责。
- 参考仓库：**`wta` 分支**，提交 [`bde2d06edf2cac28f90cba796afc51bdbf73f160`](https://github.com/NAMEWTA/obsidian-git-zh/commit/bde2d06edf2cac28f90cba796afc51bdbf73f160)。应研究该分支的实际行为，包括暂存优先提交、中文交互、冲突辅助和推送前压缩未推送提交等细节。
- 本 issue 基于文档及部分核心源码的静态核对；以下均为待实施、待验证要求，不代表 NAND 已实现或已通过运行测试。

## 必须完成的源码研读与能力对照

实施前提交一份对照表，至少记录「参考能力 → 参考文件 / 函数 → NAND 当前状况 → 实现落点 → 行为差异及理由 → 验证用例」。每项明确标记已实现、待实现、平台不支持或分阶段交付，不能以笼统的“已参考”代替。

以下链接均固定到上述参考提交：

| 研读范围 | 参考入口 | 必须弄清的问题 |
| --- | --- | --- |
| 命令与同步流程 | [main.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/main.ts)、[commands.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/commands.ts) | 初始化检查、commit / pull / push 的顺序、成功与失败返回、同步后刷新 |
| Git 抽象与平台实现 | [gitManager/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/gitManager) | GitManager 契约、simple-git 与 isomorphic-git 的差异、仓库路径与 Vault 路径转换 |
| 自动同步与串行执行 | [automaticsManager.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/automaticsManager.ts)、[promiseQueue.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/promiseQueue.ts) | 定时、编辑停止后触发、跨会话计时、暂停恢复、队列失败后继续及卸载清理 |
| 设置与本机状态 | [setting/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/setting)、[types.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/types.ts) | 默认值、自动与手动提交的区别、同步策略、定时器联动、设备专属信息 |
| 状态、差异与历史 | [ui/sourceControl/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/ui/sourceControl)、[ui/diff/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/ui/diff)、[ui/history/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/ui/history)、[statusBar.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/statusBar.ts) | 变更、暂存、提交、远端状态和操作进度如何向用户解释 |
| 冲突发现与解决 | [editor/conflicts/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/editor/conflicts)、[mergeConflictModal.ts](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/ui/modals/mergeConflictModal.ts) | 冲突识别、阻止自动提交 / 推送、保留双方内容、人工解决及后续恢复 |
| 文档与中文体验 | [README](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/README.md)、[Features](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/docs/Features.md)、[Authentication](https://github.com/NAMEWTA/obsidian-git-zh/blob/bde2d06edf2cac28f90cba796afc51bdbf73f160/docs/Authentication.md)、[i18n/](https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160/src/i18n) | 配置引导、认证、故障排查、桌面与移动端能力边界、中英文反馈 |

## 功能与行为要求

### 1. 仓库接入与配置

- 支持识别已有仓库，以及初始化 / 克隆所需的完整引导；检查 Git 可用性、仓库路径、作者身份、remote、当前分支与 upstream。
- 处理无提交的新仓库、无 upstream、远端分支尚未创建、detached HEAD 和目录非空等状态，给出可执行的下一步。
- 明确 Vault 与仓库根目录的关系、纳入同步的范围及 `.gitignore` 行为；不得意外提交仓库范围外文件或设备专属秘密。
- 桌面端优先复用系统 Git 的凭据助手 / SSH agent，凭据不进入仓库、普通可同步配置或诊断日志。

### 2. 正确的提交与同步语义

- 提供查看变更、暂存 / 取消暂存、提交、拉取、推送及一键提交并同步，正确处理新增、修改、删除、重命名和忽略文件。
- 对齐参考仓库的提交语义：普通 Commit 优先提交已暂存内容；没有暂存内容时由对应设置决定是否自动暂存全部；显式的“仅提交已暂存”“提交全部”分别保留明确语义。
- 一键 Commit-and-sync 默认提交全部变更再按配置同步；“仅提交已暂存并同步”应是明确操作；自动提交是否仅处理暂存内容由独立设置控制。
- 研读并明确 `pullBeforePush`、禁用推送、merge / rebase / reset 等选项如何影响流程。逐项解释 NAND 的取舍与支持情况；可能改写历史或丢弃内容的路径必须由用户明确选择，不能成为自动处理冲突的捷径。
- 没有新文件变更时，仍应正确识别待推送提交和远端更新；无变更、已是最新、提交成功、拉取失败、推送失败必须分别反馈。
- 专门评估 `squashCommitsBeforePush`：若提供，采用显式设置并验证仅影响未推送历史，正确处理暂存但未提交的内容、merge commit、推送目标缺失及中途失败，不能把参考代码注释当作安全证明。

### 3. 自动同步与生命周期

- 覆盖定时提交并同步、启动拉取、编辑停止后的延迟触发、独立 pull / push 间隔、暂停 / 恢复，以及跨 Obsidian 会话的时间记录。
- 手动与自动 Git 操作使用一致的调度约束，避免重复点击、文件事件和多个定时器并发修改同一仓库；与外部 Git 进程争用时应识别锁定并安全退出。
- 设置变化、模块关闭、插件卸载 / 重载、Vault 切换时正确清理和重建任务；失败后状态必须收敛，不能永久停留在“同步中”或无限重试。

### 4. 多设备冲突与失败恢复

- 两台设备修改不同文件、同一文件不同行、同一位置、删除与修改、重命名及二进制附件时，都有明确的处理结果。
- 检测 merge / rebase 进行中及未解决冲突；列出冲突文件、提供查看差异与解决入口，冲突存在时停止自动提交 / 推送，解决后允许明确恢复。
- 不得静默用某一端覆盖另一端，不得用自动 force push、hard reset 或清空工作区来伪装同步成功。
- 区分断网、超时、认证失败、权限不足、远端拒绝、Git 缺失和仓库锁定。保留本地编辑与提交，展示失败步骤及重试 / 恢复入口；部分完成不能被整体“成功”提示掩盖。
- Git 更新文件后与 Obsidian 文件事件、缓存和相关视图刷新正确衔接，验证同步期间用户继续编辑的行为。

### 5. NAND 集成与平台体验

- 结合 NAND 的 `core / platform / plugin / view` 分层实现，复用现有模块开关、设置与工作台入口，让同步规则、Git 适配、调度和 UI 各自职责清楚。
- 提供可理解的当前分支、远端、变更 / 暂存数量、待推送状态、最近同步结果和进度；必要的差异与历史入口用于解释和排查同步结果。
- 中英文命令、设置、状态和错误提示保持一致，重要配置解释实际影响。
- 给出桌面 / 移动端能力矩阵。参考仓库已明确移动端具有稳定性与功能限制，应逐项评估认证、内存、rebase、submodule 等边界，支持范围与真实验证一致。
- 子模块、编辑器行级操作、完整 blame 等扩展能力也纳入研读对照；是否纳入本次交付逐项说明。同步核心能力的缺项不得无说明地省略。

## 实施与交付

1. **研读与设计**：完成源码调用链、能力对照表、差异说明、平台支持矩阵和测试场景。
2. **手动同步闭环**：完成接入、变更与暂存、提交、拉取、推送、状态与错误反馈。
3. **自动同步与恢复**：完成调度、生命周期、并发保护、多设备冲突处理及恢复。
4. **验证与文档**：补齐用户配置 / 故障排查文档、测试报告和来源说明；按对照表逐项核销。

可以拆分关联 PR，但每个 PR 应说明所覆盖的参考能力、刻意保留的差异和实测结果。关闭本 issue 前，核心同步与恢复流程必须完整通过验收，其余对照项有明确结论。

## 验收标准

- [ ] 提交可追溯到参考源码的能力对照与调用链说明，证明已全面研读 Git 同步相关实现。
- [ ] 暂存优先提交、提交全部、仅暂存同步、自动提交模式的行为分别可复现；未选择的内容不会被意外提交。
- [ ] 使用一个临时 bare 远端和两个独立工作副本做真实 Git 集成验证，检查文件内容、Git 状态及提交图，不能仅 mock 命令成功。
- [ ] 覆盖全新仓库、已有仓库、无 upstream、仅本地变化、仅远端变化、双方变化、无工作区变化但有待推送提交、连续同步无重复提交。
- [ ] 覆盖多设备的非冲突合并、文本冲突、删除 / 重命名冲突和二进制冲突；解决或中止后能恢复且双方数据可核对。
- [ ] 断网、认证失败、远端拒绝和仓库锁定不会丢失本地编辑；部分失败不会误报同步完成，重试后状态正确。
- [ ] 重复触发、自动与手动同时触发、设置切换、暂停恢复、插件卸载 / 重载及外部 Git 操作不会造成任务泄漏、并发写入或状态卡死。
- [ ] 自动同步在持续编辑和多次短会话中按约定运行；操作结束后 UI 与实际 Git 状态一致。
- [ ] 中文 / 空格路径、大量文件与大型附件有验证记录；报告环境、规模、耗时及失败情况，不宣称未经测量的性能。
- [ ] 在真实 Obsidian 桌面宿主验证设置、命令、变更刷新和冲突恢复；移动端按声明支持范围单独验证并记录限制。
- [ ] 同步策略及未推送提交压缩等高级选项有行为说明和针对性验证；凭据不进入可同步数据或日志。
- [ ] 用户文档、来源与许可说明、能力对照和验收结果与最终实现一致。

**最终期望：真正吃透 obsidian-git-zh 的 Git 同步设计与细节，认真对照、完整实现、验证异常恢复，让 NAND 的 Git 同步可以长期可靠使用。**

## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
