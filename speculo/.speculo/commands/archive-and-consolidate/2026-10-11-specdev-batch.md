# NAND change 归档完成与 Issue 核对

## 最终结果（2026-10-11）

用户在首轮预检后明确要求继续修复 CI，并确认“只要完成了 Windows 的验收，我当前这里的验收就当是合格了”。据此继续执行原先展示的 9 个 change 归档范围。真实账号、其他平台和真实手机的原始未验证事实保留，不改写为已实测通过；发布与标签不在本轮范围。

- CI 修复已提交并推送：[2ce9e6b](https://github.com/NAMEWTA/nand/commit/2ce9e6b49718ac5691085c02db6a6a01412c9c82)、[59a3faf](https://github.com/NAMEWTA/nand/commit/59a3faf25150d5be0deb26da8993c80d93410b96)。[最终源码 CI](https://github.com/NAMEWTA/nand/actions/runs/38104882627) 的 Linux Node 22/24 与 Windows Node 24 全部成功。
- Windows 本地完整 `test:all` 50/50；Vitest 805 passed / 4 skipped。真实 Obsidian 农历布局 36 场景通过，包括 24 个展开可见场景和 12 个窄屏响应式隐藏场景。
- 61 张票、180 条 AC 的逐项原证据保留；Ticket、Map、Goal、父实现记录和共享提交 checkpoint 已补录一致，明确是实际审查后的状态补录，不伪造历史逐票派单或 61 个独立提交。
- 9 个 change、348 个文件已原子移动到 `specdev/archive/2026-10/`。全局索引为 active=0、archived=9；源目录只保留 `.gitkeep`。移动前后逐文件 SHA-256 核对通过，只有归档状态字段按流程变化；相对链接在移动前修正，双语用户文档入口同步更新。
- 原有永久知识不新增、不改写、不清理，采用 mechanical-only；本次 CI、验收范围及 issue 回执保留在 change 证据和本报告。没有清理分支、worktree 或其他用户文件。

## 归档结果

| Change | 文件数 | 入口 |
| --- | ---: | --- |
| all-open-issues | 28 | [整体归档](../../specdev/archive/2026-10/2026-10-08-all-open-issues/README.md) |
| archives-completion | 19 | [档案](../../specdev/archive/2026-10/2026-10-08-archives-completion/README.md) |
| browser-ai-workbench | 84 | [浏览器](../../specdev/archive/2026-10/2026-10-08-browser-ai-workbench/README.md) |
| git-sync-parity | 24 | [Git 同步](../../specdev/archive/2026-10/2026-10-08-git-sync-parity/README.md) |
| home-grid-rebuild | 75 | [首页](../../specdev/archive/2026-10/2026-10-08-home-grid-rebuild/README.md) |
| news-aihot | 51 | [新闻](../../specdev/archive/2026-10/2026-10-08-news-aihot/README.md) |
| private-storage-permissions | 20 | [私有存储](../../specdev/archive/2026-10/2026-10-08-private-storage-permissions/README.md) |
| terminal-reliability | 22 | [终端](../../specdev/archive/2026-10/2026-10-08-terminal-reliability/README.md) |
| workbench-regressions | 25 | [工作台](../../specdev/archive/2026-10/2026-10-08-workbench-regressions/README.md) |

## Issue 最终状态

本批核对 18 项，17 项已关闭；此前已关闭 #135、#138、#139、#141。首轮按用户授权关闭 #140、#142、#146、#147；本轮继续关闭 #124、#134、#136、#137、#143、#144、#145、#149、#150。所有新关闭操作均带唯一 marker、AI 声明、实现/验证及未验证边界，并回读确认。已关闭项没有重复评论。

仅 [#148 发布滞后](https://github.com/NAMEWTA/nand/issues/148) 保持 OPEN：新版本及新 helper 二进制尚未发布。关闭 #143/#144 表示源码修复及用户接受的本轮验收完成，不能理解为旧发行资产已经更新。[完整状态与操作回执](../../specdev/archive/2026-10/2026-10-08-all-open-issues/evidence/issue-reconcile.json)。

## 归档复验与工具修复

移动前、移动后均对全部 9 个 change 执行 `validate-specdev --stage complete`：零错误、零警告；包自检通过。归档校验器现在正确识别历史 completed/archived 记录，并验证已验收提交仍包含在父分支中，允许后续记录和归档提交推进 HEAD。active 集成仍要求精确 HEAD 和干净工作区。

隔离副本上的 6 个反例检查通过：未完成 Ticket、活动父 change 引用归档成员、未完成成员、父分支未包含结果提交、active HEAD 不匹配、active 工作区不干净仍被拒绝。文档检查通过：653 个 Markdown、1947 个本地链接。归档目录完成后未再改写。

采用用户指定的 [A 归档流程](../../../workflows/specdev/A-archive-and-consolidate/A-archive-and-consolidate.md) 和 [archive-and-consolidate 技能](../../../skills/archive-and-consolidate/SKILL.md)。原始工件备份、逐文件清单和校验结果保存在本机临时审计目录；它们没有替代仓库里的验收证据。

## 首轮预检历史

以下保留首次预检时的判断、完整移动计划和最初四项关闭回执。其“不能归档／未授权例外”结论已被上方用户后续指示、CI 修复和最终执行结果取代。

核对日期：2026-10-11。请求范围：`speculo/.speculo/specdev/changes/` 下全部 9 个 change，以及对应 GitHub issue 的完成核对与关闭。核对基线：[a0c15de](https://github.com/NAMEWTA/nand/commit/a0c15deadc0cb4f066b1db82d58f7c016a50808b)，已推送至 `NAMEWTA/nand` 的 `main`。开始核对时工作区干净。

## 结论

当前不能按指定流程将这批 change 归档为完成：9 个 change 的正式状态均为 `active`；61 张票仍为规划时的 `ready`，Goal Plan 和父实现计划仍是 `draft`；真实账号、部分平台验收未完成，最新 CI 也失败。代码审查完成、单元测试通过与产品全部验收完成是不同结论。

本轮完整读取 13 个原来源 issue 加 5 个后续回归 issue，共 18 个，包含全部评论；读取前后检查正文、状态、更新时间和评论数量，分页完整。已有关闭 4 个，本次按授权关闭 4 个，另 10 个保持打开。仅关闭具体缺陷，不将其所属的整个 change 或其他 issue 标为完成。

归档移动、永久知识提升和清理均未执行。未修改原始 issue 快照、change 合同、Ticket 状态或已有验收记录；本报告是新增的命令记录。

## 当前验证事实

- 本地审查记录：Vitest 805 通过、4 跳过；构建、lint、架构、i18n、CSS、包体及文档等定向检查通过。见[审查报告](../../specdev/archive/2026-10/2026-10-08-all-open-issues/review-report.md)。
- 最新远程 [Node.js build，run 38102505664](https://github.com/NAMEWTA/nand/actions/runs/38102505664) 已结束且失败，提交为 `a0c15deadc0cb4f066b1db82d58f7c016a50808b`。Node 24 Linux 的 `test:all` 为 41/50，Windows 为 39/50；Node 22 被取消。`check:notices` / `check:native` 的 Linux 后续步骤被跳过。
- Linux 失败脚本：`test:folder-tag-search`、`test:layout-stacked`、`test:widget-span`、`test:library-card-size`、`test:countdown-picker`、`test:gallery-placeholder`、`test:property-operator`、`test:issue-regressions`、`test:workbench-lifecycle`。
- Windows 除以上 9 项，还失败于 `test:safety-regressions`、`test:unit`。Vitest 803 通过、2 失败、4 跳过；失败为 Git clone 的目标目录并发写入保护与生产 host clone 用例。本轮只读取失败证据，没有认定根因或把失败改为通过。
- 用户此前明确选择真实账号“暂不方便，保留未验证”；本次没有把它解释为通过或取消验收。
- 所有 change 的 `validate-specdev.mjs --stage complete` 均退出 1：状态不为 completed、子 change 的 external_action 仍为 pending-close，并有规划时绑定的 Skill/reference 摘要漂移。父聚合检查为 662 个诊断，其中 661 个摘要漂移和 1 个状态错误；摘要错误包含重复投影，不表示 661 个独立产品缺陷。

## Issue 核对

| Issue | 读取时状态 | 本次处理 | 依据与未完成条件 |
| --- | --- | --- | --- |
| [#124 档案](https://github.com/NAMEWTA/nand/issues/124) | OPEN | 保留 | 列表/卡片、全文检索、49 项桌面宿主和 9 组规模证据已存在；原 issue 明列手机、输入法验收，AC-008 仍为 partial。 |
| [#134 Git 同步](https://github.com/NAMEWTA/nand/issues/134) | OPEN | 保留 | 已有真实 Git 与 clone 宿主证据；最新 Windows CI 出现 2 个 clone 用例失败，SSH/完整原生冲突矩阵仍不完整。 |
| [#135 终端下载](https://github.com/NAMEWTA/nand/issues/135) | CLOSED | 保持关闭 | 远程已有复测与关闭记录；不重复评论或关闭。 |
| [#136 新闻](https://github.com/NAMEWTA/nand/issues/136) | OPEN | 保留 | 原 issue 要求 Claude Code 和 Codex 真实账号闭环；现有协议样本不满足该项。 |
| [#137 首页看板](https://github.com/NAMEWTA/nand/issues/137) | OPEN | 保留 | 77 条 AC 的本地审查已记录，但真实手机/CLI 条件未完成；最新相关回归脚本失败。 |
| [#138 遮罩吞图标点击](https://github.com/NAMEWTA/nand/issues/138) | CLOSED | 保持关闭 | 远程已有 Linux 复测关闭，本地 Windows 也有通过记录。 |
| [#139 模块图标布局](https://github.com/NAMEWTA/nand/issues/139) | CLOSED | 保持关闭 | 远程已有 Linux 复测关闭，本地 Windows 也有通过记录。 |
| [#140 下拉框语言宽度](https://github.com/NAMEWTA/nand/issues/140) | OPEN | 关闭具体缺陷 | [真实宿主记录](../../specdev/archive/2026-10/2026-10-08-workbench-regressions/evidence/review-runtime.json)：中英往返重新测量、值不变、无伪回调、销毁/重开和规则选择器通过。 |
| [#141 窄屏快捷栏](https://github.com/NAMEWTA/nand/issues/141) | CLOSED | 保持关闭 | 远程已有 Linux 原步骤复测通过和关闭记录。 |
| [#142 浏览器快捷键](https://github.com/NAMEWTA/nand/issues/142) | OPEN | 关闭具体缺陷 | [快捷键证据](../../specdev/archive/2026-10/2026-10-08-browser-ai-workbench/evidence/review-host-shortcuts.json)：先复现，接入宿主 Scope 后 Windows 原生 26 项通过；不声称 Linux/macOS 重测。 |
| [#143 helper 继承句柄](https://github.com/NAMEWTA/nand/issues/143) | OPEN | 保留 | 远程评论确认旧 main 本地编译版已改善，但发布的 helper 未包含修复；当前 POSIX 修订未实测。 |
| [#144 私有目录权限](https://github.com/NAMEWTA/nand/issues/144) | OPEN | 保留 | 全域存储与遗留修复实现已补齐，但 POSIX 权限/链接/SQLite sidecar 运行时仍未验证；发布 helper 也未更新。 |
| [#145 多 AI 工作台](https://github.com/NAMEWTA/nand/issues/145) | OPEN | 保留 | 三站真实账号 Gate、八站登录/发送/采集兼容性和真实模型 CLI 未验证。 |
| [#146 私有存储动态导入](https://github.com/NAMEWTA/nand/issues/146) | OPEN | 关闭具体加载回归 | 动态 Node ESM 加载已改为 desktop 内静态导入并随 CJS 构建；[profile 原生证据](../../specdev/archive/2026-10/2026-10-08-browser-ai-workbench/evidence/review-profiles.json)有持久化、权限和重启检查。POSIX 0700/0600 的验收另留 #144，不冒称已通过。 |
| [#147 默认 AI 栏挤占网页](https://github.com/NAMEWTA/nand/issues/147) | OPEN | 关闭具体缺陷 | 旧 AiBar 已删除，多 AI 工作台使用独立入口；[工作台证据](../../specdev/archive/2026-10/2026-10-08-browser-ai-workbench/evidence/review-workspace.json)及[面板验收](../../specdev/archive/2026-10/2026-10-08-browser-ai-workbench/evidence/review-panel-layout.json)覆盖新布局与本地化。 |
| [#148 发布产物落后](https://github.com/NAMEWTA/nand/issues/148) | OPEN | 保留 | 本次只 commit/push，没有升版本或 Release，也没有更新发布 helper。 |
| [#149 test:all / CI](https://github.com/NAMEWTA/nand/issues/149) | OPEN | 保留 | 最新 a0c15de 的远程 CI 仍失败，详见上节。 |
| [#150 农历文字遮挡](https://github.com/NAMEWTA/nand/issues/150) | OPEN | 保留 | 仍有绝对定位求签按钮，标题区无明确对应避让；现有农历验收主要是日期换算，未定位到本缺陷的通过证据。未作新的宿主复现，不宣称仍必然复现。 |

## 关闭操作的准确内容

目标仓库统一为 `NAMEWTA/nand`，close reason 为 `completed`。使用已推送的公开 commit；每条评论注明 AI 协助。执行前重读 issue 与 marker，逐项评论、关闭并读回；已关闭的 4 个 issue 不写入。用户本次明确授权“对应的 issue 如果已经完成的话，帮我 close 掉”，该授权用于下列已核对的具体缺陷。

### #140

```markdown
> *This was generated by AI during SpecDev T-triage reconcile.*

已修复实时切换语言后的下拉框宽度刷新：更新选项后通过宿主控件重新测量，隐藏页显示时补测，保留选值且不触发伪 onChange。

修复提交：https://github.com/NAMEWTA/nand/commit/a0c15deadc0cb4f066b1db82d58f7c016a50808b

验证：真实 Windows Obsidian 中英文往返、隐藏页返回、控件销毁/重开及规则选择器通过；“仅限移动设备”测得宽度 120px，所需约 119.6px。Linux/macOS 未重新实测。按该缺陷的修复证据关闭；整仓 CI 的剩余失败继续由 #149 跟踪。
```

Marker：`specdev:2026-10-08-workbench-regressions:issue-140:completion`。

### #142

```markdown
> *This was generated by AI during SpecDev T-triage reconcile.*

已将地址栏和工具栏的 Ctrl/Cmd+F、Ctrl/Cmd+L 接入所属窗口的 Obsidian Scope；切走、弹窗、guest 焦点及卸载时正确释放，不再依赖被宿主拦截后的 DOM 冒泡按键。

修复提交：https://github.com/NAMEWTA/nand/commit/a0c15deadc0cb4f066b1db82d58f7c016a50808b

验证：先在旧产物复现地址栏输入被追加，再完成 Windows 原生 26 项检查，覆盖地址栏连续三次查找、工具栏、网页、弹窗、分屏和弹出窗口。Linux/macOS 与系统 IME 未重新实测。此关闭仅针对快捷键缺陷；真实 AI 账号验收仍由 #145 保持打开，CI 另见 #149。
```

Marker：`specdev:2026-10-08-browser-ai-workbench:completion`。

### #146

```markdown
> *This was generated by AI during SpecDev T-triage reconcile.*

已移除私有存储层中交给浏览器 ESM 加载器的动态 Node 模块导入，改为 desktop 边界内的静态导入并生成 CJS 产物；浏览器与新闻使用统一宿主存储入口。

修复提交：https://github.com/NAMEWTA/nand/commit/a0c15deadc0cb4f066b1db82d58f7c016a50808b

验证：Windows 真实 Obsidian 中的浏览器 profile 持久化、站点权限、应用重启与工作台保存/恢复检查通过，原 CORS 导入路径已移除。未声称在 Linux 重测 POSIX 文件权限；0700/0600 和旧文件修复的运行时验收仍由 #144 跟踪，CI 剩余失败见 #149。
```

Marker：`specdev:2026-10-08-private-storage-permissions:issue-146:completion`。

### #147

```markdown
> *This was generated by AI during SpecDev T-triage reconcile.*

已删除普通浏览器页上默认展示的 AiBar 原型，多 AI 工作台改为独立入口；普通网页不再被该栏挤占，新工作台使用正式布局和中英文状态文案。

修复提交：https://github.com/NAMEWTA/nand/commit/a0c15deadc0cb4f066b1db82d58f7c016a50808b

验证：普通浏览器原生回归以及工作台面板的 Windows 原生 104 项验收通过，包含 18 组主题/宽度场景、窄屏切换、重启恢复与布局操作不触发发送。使用受控网页样本；真实 AI 账号兼容性仍由 #145 保持打开，整仓 CI 的剩余失败见 #149。
```

Marker：`specdev:2026-10-08-browser-ai-workbench:issue-147:completion`。

## 归档 dry-run 计划

模式：`archive-batch`。本报告只准备计划，当前整批状态为 `blocked`，不是已确认的归档执行。

路径均从 `workspace.json` 的 project-root 相对 roots 解析：

| 项 | 根目录 |
| --- | --- |
| workflow_root | `speculo/workflows/specdev` |
| state_root | `speculo/.speculo/specdev` |
| changes_root | `speculo/.speculo/specdev/changes` |
| archive_root | `speculo/.speculo/specdev/archive` |
| commands_root | `speculo/.speculo/commands` |
| commands_def_root | `speculo/commands`，只读命令定义 |

以下为全部移动候选。源目录均存在且没有符号链接，9 个目标均不存在。每项动作均是整目录移动，具有中等风险；未经下述门禁处理不会执行。

| change | source（changes_root 下） | target（archive_root 下） | 文件数 | 当前阻碍 |
| --- | --- | --- | --- | --- |
| 总控 | `2026-10-08-all-open-issues` | `2026-10/2026-10-08-all-open-issues` | 21 | 父/子完成门、聚合验收、最新 CI 均未闭合 |
| 档案 | `2026-10-08-archives-completion` | `2026-10/2026-10-08-archives-completion` | 16 | 手机/IME 条件；正式状态；未完成父 Goal |
| 浏览器 | `2026-10-08-browser-ai-workbench` | `2026-10/2026-10-08-browser-ai-workbench` | 81 | 真实账号 Gate；正式状态；未完成父 Goal |
| Git | `2026-10-08-git-sync-parity` | `2026-10/2026-10-08-git-sync-parity` | 21 | 当前 CI clone 失败；认证/完整宿主矩阵；未完成父 Goal |
| 首页 | `2026-10-08-home-grid-rebuild` | `2026-10/2026-10-08-home-grid-rebuild` | 70 | 当前回归失败、手机/真实 CLI；未完成父 Goal |
| 新闻 | `2026-10-08-news-aihot` | `2026-10/2026-10-08-news-aihot` | 48 | 真实 Claude Code/Codex 账号；未完成父 Goal |
| 私有存储 | `2026-10-08-private-storage-permissions` | `2026-10/2026-10-08-private-storage-permissions` | 17 | POSIX 实测和发布 helper；未完成父 Goal |
| 终端 | `2026-10-08-terminal-reliability` | `2026-10/2026-10-08-terminal-reliability` | 19 | POSIX 实测和发布 helper；未完成父 Goal |
| 工作台回归 | `2026-10-08-workbench-regressions` | `2026-10/2026-10-08-workbench-regressions` | 22 | 行为证据完整，但正式完成账本未转换，且属于未完成父 Goal |

正常执行前需要：修复/裁决当前 CI；完成必要账号/平台验收或取得明确的范围变更；将已发生的实现提交与验收记录回填 Ticket/workspace/Goal（不编造逐票提交）；重验 Skill 绑定摘要；由唯一 Lead 完成子/父状态转换；核对远程关闭账本；再重跑 complete 门禁。

门禁通过后的机械动作是：创建 `archive/2026-10/`，逐目录原子移动，更新归档 `.status.json` 与全局 `active/archived` 索引，修复移动造成的引用位置，保留源目录空壳，重读全部目标及索引并校验。需要先记录文件摘要和备份；目标漂移、重复目录或不一致时整批停止，不覆盖已有归档。

## 永久知识与清理计划

本轮未满足 completed 门，不能将未完成的实现/验证结论提升为 Accepted 知识。`adr/`、`context/`、`research/` 由 SpecDev A 拥有，保持原内容；本轮提升 0、改写 0、删除 0。当前审查证据保留在各 change 中。没有创建或接管知识事务、锁或其他任务的恢复记录。

若用户明确改选“未完成快照归档”，那是对本次完成门和父成员限制的特例，需要明确记录：保留上述未验证项、CI 失败、open issue、未完成 Ticket 与空 completed_at；不得把快照移动表述为全部验收通过，也不提升其未验证知识。当前尚未获得此范围选择，不擅自取消验收或删除未完成项。

## 授权与流程依据

用户已授权核对并关闭确实完成的 issue；未增加发版、PR、远程未完成项关闭或新功能实施。

[A 归档入口](../../../workflows/specdev/A-archive-and-consolidate/A-archive-and-consolidate.md)要求本地完成和父成员完成门。[Change completion](../../../workflows/specdev/common/rules/change-completion.md)要求没有未批准的 blocker/unverified，且工件、Git 和验证一致。[归档技能](../../../skills/archive-and-consolidate/SKILL.md)明确要求“预执行完整计划 → 用户显式确认 → 执行 → 执行后验证补遗”。因此本报告不把初始归档请求当作对新发现 CI 失败和未完成验收的豁免。

## 执行回执

以下操作已通过 T 的 `issue-comment-close` 执行并再次读取确认，均为 `state=CLOSED`、`state_reason=completed`，对应 marker 各存在一次。gh 2.46 的分页兼容 runner 逐页读取 API 数组，保留 transport 的读取前后漂移检查；未修改工具源文件。

| Issue | 关闭评论回执 | 读回时间（UTC） |
| --- | --- | --- |
| #140 | [评论及关闭](https://github.com/NAMEWTA/nand/issues/140#issuecomment-6104349182) | 2026-10-11 01:50:24.568 |
| #142 | [评论及关闭](https://github.com/NAMEWTA/nand/issues/142#issuecomment-6104351277) | 2026-10-11 01:50:43.100 |
| #146 | [评论及关闭](https://github.com/NAMEWTA/nand/issues/146#issuecomment-6104353257) | 2026-10-11 01:50:58.543 |
| #147 | [评论及关闭](https://github.com/NAMEWTA/nand/issues/147#issuecomment-6104355107) | 2026-10-11 01:51:15.010 |

归档保持 blocked；没有移动源目录，没有改动全局 active/archived 索引、Ticket/Goal 状态或永久知识。18 个核对对象目前共 8 个已关闭、10 个打开。新增本报告，原文件不受修改，无覆盖备份动作；当前源码恢复点为公开提交 `a0c15deadc0cb4f066b1db82d58f7c016a50808b`。

`pnpm test:docs` 通过：625 份 Markdown、1654 条本地链接、350 条外部链接（未执行外链抓取）。本报告的 9 条本地链接另行逐项解析，均存在；命令报告根和 change 根均检查过真实路径包含关系。源码和构建产物没有改动，本轮未重新执行产品测试；远程 CI 失败与归档 complete 门失败如实保留。
