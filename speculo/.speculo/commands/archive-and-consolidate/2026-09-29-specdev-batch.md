# 2026-09-28 开放问题批次归档

## 授权与路径

用户要求先处理 GitHub #31 的最新残留，再归档 <Path>{roots.state}/specdev/changes/</Path> 下的全部 change，并关闭对应来源 Issue。模式：archive-batch。知识策略：generic，本批全部判定为 ephemeral，不写入永久知识，也不清理已有 ADR / context。

项目根由 <Path>{roots.state}/workspace.json</Path> 的 project-root 解析。报告位于 <Path>{roots.state}/commands/archive-and-consolidate/</Path>。

## 产品修复

#31 在 `f920895e4a9038cd873c4bdf3ef45d31e7202abc` 的复测里只剩筛选弹窗分组标题比选项更靠右。原因是 Obsidian 1.13 给 `.setting-item-heading` 两侧各留 `--size-4-4`，而该弹窗的选项行不在设置卡片里，横向间距为 0。修复只给筛选弹窗加上 `nand-contacts-filter`，并把该弹窗的标题横向间距清零，不改全局 Setting，也不去掉 `setHeading()`。

按同一间距规则测量：修正前标题比选项右移 16px，修正后差值为 0。没有在真实 Obsidian 窗口里重开弹窗。该改动仍在工作区，没有提交或推送。

## 归档计划

十个 change 在移动前都是 `change_status: completed`，`current_work` 为空，没有 blocker 或 deviation。九个来源 Issue 的 `publish_action` 保持 `not-requested`。父 change 没有来源 Issue。

| 来源 | 目标 | 动作 | 知识 |
|---|---|---|---|
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-30-live-language-refresh/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-31-contacts-polish/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-31-contacts-polish/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-32-product-copy/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-36-automation-presentation/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-37-terminal-release/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-38-agent-preflight/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-39-widget-source/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-40-visible-export/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-40-visible-export/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-issue-41-workbench-usability/</Path> | 原子移动 | ephemeral |
| <Path>{roots.state}/specdev/changes/2026-09-28-open-issues-remediation-goal/</Path> | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-open-issues-remediation-goal/</Path> | 原子移动 | ephemeral |

筛选标题间距是单次实现细节，不满足稳定机制、重复教训或接手者必知。已有九份 ADR 和 context 词汇表创建于文档沉淀，未被本批改写。没有删除、合并或改写永久知识。

## 来源 Issue

仓库 NAMEWTA/nand。关闭原因 completed。八个 Issue 在补标记前已经关闭，只追加完成评论。#31 先评论再关闭。

| Issue | Change | 远程结果 |
|---|---|---|
| #30 | 2026-09-28-issue-30-live-language-refresh | 已关闭，补标记 |
| #32 | 2026-09-28-issue-32-product-copy | 已关闭，补标记 |
| #36 | 2026-09-28-issue-36-automation-presentation | 已关闭，补标记 |
| #37 | 2026-09-28-issue-37-terminal-release | 已关闭，补标记；公开 Release 0.0.3 |
| #38 | 2026-09-28-issue-38-agent-preflight | 已关闭，补标记 |
| #39 | 2026-09-28-issue-39-widget-source | 已关闭，补标记 |
| #40 | 2026-09-28-issue-40-visible-export | 已关闭，补标记 |
| #41 | 2026-09-28-issue-41-workbench-usability | 已关闭，补标记 |
| #31 | 2026-09-28-issue-31-contacts-polish | 本次评论后关闭 |

#42、#43、#44 不属于这批 change，保持打开。没有请求票级发布。

## 执行后验证补遗

完成时间：2026-09-29T01:29:06.336905+00:00。

- 移动前十个 change 的 `--stage complete` 均为 0 error、0 warning。没有使用 `--repo`：历史 `result_sha` 不等于当前 HEAD，而且筛选修复使工作区不干净。
- 十个源目录已不在 changes 下。changes 只保留 `.gitkeep`。十个目标目录的文件集合与移动前一致。
- 每个归档 `.status.json` 为 `change_status: archived`、`archived: true`，`archive_path` 指向对应月份目录，原 `completed_at` 保留，`works_run` 追加 `specdev/archive-and-consolidate`。
- 全局 `active` 为空。上述十个名称只出现在 `archived`，与原有五项没有重叠。
- 2026-09-29T01:25:58Z 重读九个 Issue 均为 closed，且评论含对应 `specdev:<change>:completion` 标记后，才把 triage 的 `external_action` 写成 `closed`。
- 归档后单独校验 #31 change：0 error、1 warning，警告只说明正在校验已归档 change。
- 归档后校验父 change：10 error、1 warning。九个错误是「已归档 change 不能再当实现成员」，另一个是「已完成的 Map / Plan 要求父状态仍为 completed」。这是校验器对归档父实现的现有限制。归档前 complete 已通过，没有改写 Map / Plan，也没有回滚移动。
- 没有提交、推送或升版本。筛选修复仍是 `main.js`、`src/view/contacts/forms.ts`、`styles.css` 的未提交改动。
