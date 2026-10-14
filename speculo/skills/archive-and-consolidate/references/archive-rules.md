# Archive Rules

归档会移动目录并更新状态。调用方先准备具体计划并核对已有授权；目标、动作与风险已获批准时不再次询问，新增破坏性范围才补充授权。

## 共同预检

对每个候选 change 执行：

- change 名称符合日期 kebab 规则：`^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$`（`YYYY-MM-DD-<kebab-topic>`）。格式校验来源与路径解析步骤相同；已有不带日期前缀的历史 change 标注为遗留，不阻塞但记录警告。
- `.status.json` 可解析，`change_status` 字段存在且值为 `completed`。
- 源位于 `changes_root/<change>` 且真实存在。
- 目标位于 `archive_root/<YYYY-MM>/<change>`（YYYY-MM 从 change 名称提取），目标目录不存在。
- Workflow `status.json` 与 change 状态一致：change 条目唯一出现在 `active` 数组中，且不在 `archived`；业务完成状态只由 change `.status.json#change_status: completed` 表达。
- 若 worktree 模式：实现已集成且无未闭合 candidate；未集成则记录 `blocked`。可恢复的来源 worktree/branch 清理按单独授权执行，不自动成为归档前置。
- **任一预检失败阻塞整批操作**；这不等于跨目录和索引的原子事务。

## 归档移动步骤

1. 创建 `archive_root/<YYYY-MM>/` 月目录（如不存在）。
2. 将 `changes_root/<change>/` 整个目录移动到 `archive_root/<YYYY-MM>/<change>/`。使用原子移动（mv/rename），不用复制后删除。
3. 从 workflow `status.json` 的 `active` 数组中移除该 change 条目，将 change 名称去重追加到 `archived`。全局索引不保存路径、时间、Work 或 promotion 明细。
4. 按调用方 schema 更新已移动的 `.status.json` 的归档终态、时间和路径；只写 schema 声明的字段，只有声明了 `archived` 布尔字段才写 `true`。`archive_path` 遵守调用方的路径合同；SpecDev 使用 `<Path>{roots.state}/specdev/archive/YYYY-MM/{change}</Path>`，不写机器绝对路径或另造普通相对路径。
5. 若 `changes_root/` 目录变空，保留空目录和 `.gitkeep`（如存在）。

## 失败恢复与重入

调用方 owner 负责本次事务和恢复，记录放在调用方已有报告或事务位置，不另建 Skill 状态树。

1. 写入前记录精确移动清单、源/目标身份与摘要、相关状态文件的前像；执行中逐项记录已完成动作。单目录 rename 的原子性不代表整批移动和多个状态文件共同原子。
2. 中途失败时停止本事务后续动作；先核对已写目标和状态仍属于本次事务且未被他人改变，再按逆序恢复本次移动与状态前像。恢复已有授权范围内的写入，不删除未知目标，不覆盖其他任务状态。
3. 无法安全恢复时保留目录、前像与动作记录，报告具体残留、失败原因和恢复入口，状态保持 blocked；不承诺“失败时没有部分移动”。只阻塞受影响写集及依赖。
4. 重入由原 owner 读取记录、核对实际源/目标和状态；只继续未完成动作或恢复，不重复移动已完成项。全部恢复后可重新预检；全部执行后重读验证，才标 verified。

## 冲突处理

| 冲突 | 处理 |
|------|------|
| 目标已存在 | `blocked`——永不覆盖归档；需手动解决 |
| `.status.json` 不可解析或格式错误 | `blocked`——整批阻塞 |
| change 不在 `status.json#active` 中 | `blocked`——状态不一致 |
| change 名称不含日期前缀（遗留） | 警告但不阻塞；从文件修改时间推断 YYYY-MM |
| 归档月目录创建失败（权限） | `blocked`——报告具体错误 |

## 重读验证

归档执行后逐项验证：

1. 源路径不存在（移动成功）。
2. 目标路径完整存在，内容与移动前一致。
3. Workflow `status.json` 的 `active` 数组已移除该 change，`archived` 数组已追加其名称，且两者没有重叠。
4. 归档目录 `.status.json` 的终态、声明字段和路径符合调用方 schema；不要求不存在的字段。
5. 验证失败时进入上述恢复流程，报告已完成/未完成清单，不猜测成功。

完成标准：源不存在、目标完整、active 索引已移除且 archived 名称已追加、归档状态字段一致。
