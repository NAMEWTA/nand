# Git 与全局 State 契约

本契约仅用于用户明确授权的 `mode=commit`，定义可复现输入、限定范围的提交和 docs-sync state v4。audit/update 不执行本契约中的任何 Git 或 state 写入；调用方拥有 Git 与持久化副作用。

## 固定输入与提交范围

1. 确认唯一仓库、HEAD 与 Git 操作状态；未完成的 merge/rebase/cherry-pick 等只阻塞受影响的提交，独立审计仍可继续。
2. 记录 staged、unstaged 与 untracked 路径及归属。保留无关改动和暂存状态，不为清洁工作区提交、stash、reset 或删除它们。
3. 将提交范围固定到本次文档、报告、state 和 sidecar；核对该范围的 diff、敏感信息与适用验证。无法归属的改动或漂移仅阻塞重叠写集及其依赖。
4. 同步游标只能覆盖可由固定 commit 重建的事实。若目标文档依赖未提交源码，先核对用户是否已授权提交这些具体源码；已授权才按显式路径创建来源 checkpoint 并验证，否则完成可独立更新的文档，相关输出保留 update 状态，不推进该同步游标。
5. 无关 dirty 文件不妨碍提交。存在其他暂存改动时使用限定路径的提交方式（如 `git commit --only -- <paths>`），核对 commit 实际内容及剩余 index；不将无关文件纳入提交，不改写其暂存状态。
6. 固定 `INPUT_HEAD`，记录来源 checkpoint（若有）、提交路径和验证结果。空工作区不是前置条件。

完成标准：输入可复现，授权路径和 Git 基线明确，现有用户工作保持不变。

## State v4

默认路径为 `<Path>{roots.state}/commands/docs-sync/state.json</Path>`：

```json
{
  "schema_version": 4,
  "command": "docs-sync",
  "state_path": "<Path>{roots.state}/commands/docs-sync/state.json</Path>",
  "baseline": { "mode": "explicit", "sha": null },
  "last_range": { "from_sha": null, "to_sha": null },
  "project_targets": [],
  "pending_legacy_targets": [],
  "scope_revision": 0,
  "scope_confirmed_at": null,
  "last_sync_run_at": null,
  "total_syncs": 0,
  "synced_assets": []
}
```

- `project_targets` 只保存不归属具体 workflow 的已确认项目文档目标。
- `baseline.mode` 为 `state-file-commit | explicit`。正常运行使用前者；迁移暂存使用后者。
- `last_range` 保存本次审计输入的两个 commit；`from_sha` 仅在 bootstrap 时可为 `null`。
- `pending_legacy_targets` 只用于迁移后等待用户重新确认的旧路径。
- state 不保存 diff、用户确认原文、绝对路径、个人信息或密钥。

## 基线解析

1. `state-file-commit`：运行 `git log -1 --format=%H -- "$STATE_FILE"`，把最后修改 state 的 commit 作为 `FROM_SHA`。
2. `explicit`：使用 `baseline.sha`；为 `null` 时进入 bootstrap。
3. 非空 `FROM_SHA` 必须是 `INPUT_HEAD` 的祖先；浅克隆缺历史、分支分叉或损坏 SHA 均阻塞。
4. 常规范围固定为 `FROM_SHA..INPUT_HEAD`；bootstrap 盘点当前项目事实，不对 `null` 执行 git diff。
5. 固定收集 log、name-status、shortstat 和具体文件 diff；commit 标题只用于导航，结论必须回到文件事实。

`last_range.from_sha/to_sha` 必须支持直接运行 `git diff "$FROM_SHA..$INPUT_HEAD"` 复现输入。

## v1-v3 迁移

- `tracked_docs`、`tracked_assets` 原样放入 `pending_legacy_targets`，不得自动转成授权。
- `synced_docs` 映射为 `synced_assets`；移除 short SHA、commit subject/date 等派生字段。
- `baseline` 使用 `explicit` 和旧 `last_sync_sha`；`last_range` 使用旧 `previous_sync_sha/last_sync_sha`。
- 首次 v4 运行统一展示、分类并确认 pending targets；成功后清空 pending，切换为 `state-file-commit`。

## 写回与提交

1. 验证通过后写同目录临时文件，再原子 rename state、报告和 sidecar；JSON 使用 2 空格和尾部换行。
2. 更新 `last_range={from_sha: FROM_SHA, to_sha: INPUT_HEAD}`、运行时间、计数和实际同步资产；正常输出将 baseline 设为 `{mode: "state-file-commit", sha: null}`。
3. 显式暂存本次文档、报告、state 和 sidecar。实际修改使用 `docs(docs-sync): synchronize project documentation`；no-op 使用 `chore(docs-sync): record no-op synchronization`。
4. commit 失败时保留证据并阻塞，不重写历史或丢弃文件。成功后回读 commit 的路径与内容，确认本次输出均已提交、剩余改动与初始无关工作一致；不要求整个工作区为空。

下次运行通过 state 文件的 Git 历史定位本次输出 commit，因此不会把本次报告和文档提交重复纳入输入范围。
