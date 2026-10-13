# vault 数据统一：归档与知识归并计划

生成时间：2026-10-13T09:06:48.350461+00:00；模式：archive-single / dry-run；唯一owner：root。

编码与发行已完成：alpha.2产品源9c0bd5c，正式工作流38370493282成功；18资产核对、新装13/13、升级15/15、浏览器36/36通过；#151/#148均CLOSED。八票done，change completed；完成/发行/包级校验均0错误0警告。整个Goal仍等待本计划执行。

## 归档移动

将 `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/` 原子移动到 `speculo/.speculo/specdev/archive/2026-10/2026-10-11-vault-data-unification/`。源存在、目标不存在，路径真实包含检查通过；仅此一个change。历史归档目录不改写。

执行时更新全局status：active移除该change，archived去重追加；归档.status置archived，保留原completed_at与全部实现SHA，填写archive_path。修正所选change元数据/Markdown的Path引用以及TRI-001和本报告中的现行链接，历史日志内容保持原文。

## 知识合并与重复文件删除

18项：13 ADR、3 context、2配置索引。每项均为**改写规范目标并删除其同目录.ZH.md重复文件**，风险中等；已先合并两种版本仍有效的独有事实，并按源码与T-01至T-08证据更新。原始许可、测试夹具、旧归档、根README双语版本均保留。

[完整候选路径、原始/候选摘要及字符数](../../specdev/changes/2026-10-11-vault-data-unification/evidence/knowledge-plan.json)。下表路径相对于 `speculo/.speculo/specdev/`，候选位于该change的 `evidence/knowledge-candidates/` 对应路径加 `.txt`。

| 项 | 规范目标（改写） | 同目录重复版本（删除） | 原两份字符数 → 合并后 | 动作 |
|---|---|---|---|---|
| 1 | `adr/0001-module-contract.md` | `0001-module-contract.ZH.md` | 3816+1920 → 1922 | 合并中文候选并删除重复版本 |
| 2 | `adr/0002-lazy-loading-and-budgets.md` | `0002-lazy-loading-and-budgets.ZH.md` | 3115+1565 → 1527 | 合并中文候选并删除重复版本 |
| 3 | `adr/0003-namespaced-settings-store.md` | `0003-namespaced-settings-store.ZH.md` | 2987+1572 → 1585 | 合并中文候选并删除重复版本 |
| 4 | `adr/0004-data-placement.md` | `0004-data-placement.ZH.md` | 4278+2156 → 2267 | 合并中文候选并删除重复版本 |
| 5 | `adr/0005-three-column-workbench.md` | `0005-three-column-workbench.ZH.md` | 3825+1785 → 1780 | 合并中文候选并删除重复版本 |
| 6 | `adr/0006-global-theme.md` | `0006-global-theme.ZH.md` | 2343+1321 → 1326 | 合并中文候选并删除重复版本 |
| 7 | `adr/0007-interface-language.md` | `0007-interface-language.ZH.md` | 2337+1102 → 1101 | 合并中文候选并删除重复版本 |
| 8 | `adr/0008-terminal-helper.md` | `0008-terminal-helper.ZH.md` | 4157+2102 → 2190 | 合并中文候选并删除重复版本 |
| 9 | `adr/0009-agent-sessions-and-history.md` | `0009-agent-sessions-and-history.ZH.md` | 3326+1650 → 1966 | 合并中文候选并删除重复版本 |
| 10 | `adr/0010-browser-sessions.md` | `0010-browser-sessions.ZH.md` | 3667+1768 → 1961 | 合并中文候选并删除重复版本 |
| 11 | `adr/0011-automation-and-notifications.md` | `0011-automation-and-notifications.ZH.md` | 4075+1970 → 1973 | 合并中文候选并删除重复版本 |
| 12 | `adr/0012-git-sync.md` | `0012-git-sync.ZH.md` | 4493+2131 → 2248 | 合并中文候选并删除重复版本 |
| 13 | `adr/0013-license-and-attribution.md` | `0013-license-and-attribution.ZH.md` | 3830+2036 → 2030 | 合并中文候选并删除重复版本 |
| 14 | `context/context-map.md` | `context-map.ZH.md` | 8271+3793 → 3904 | 合并中文候选并删除重复版本 |
| 15 | `context/current-baseline.md` | `current-baseline.ZH.md` | 8071+5176 → 4629 | 合并中文候选并删除重复版本 |
| 16 | `context/validation.md` | `validation.ZH.md` | 5955+2959 → 1063 | 合并中文候选并删除重复版本 |
| 17 | `.config/domain-layout.md` | `domain-layout.ZH.md` | 7150+3869 → 3702 | 合并中文候选并删除重复版本 |
| 18 | `.config/tracking.md` | `tracking.ZH.md` | 1761+882 → 851 | 合并中文候选并删除重复版本 |

目标/重复版本/候选的SHA-256均已与T-07计划逐一核对，无漂移；本次增加的T-08事实已有最终发行与宿主证据。逐文件摘要和整个change文件清单在同名JSON计划中。回滚备份位于 `scripts/tmp/vault-unification-resume/T-08/A-backup/`；原始Git提交亦保留。

## 执行与验证

1. 确认后重新验证状态、所有摘要、目标不存在和路径包含；发现漂移则停止受影响动作。
2. 移动这一个change、更新状态及受影响的现行引用。
3. 写入18份已审阅候选，删除对应18份重复版本；不删除其他文件。
4. 重读源已不存在、目标完整、active/archived不重叠、知识中文单源及链接；运行完成/包级校验和test:docs。
5. 写执行后补遗，记录每项提升结果、实际删除数、字符数和回滚位置，按已有commit/push授权提交并推送文档收尾。无产品代码、标签或Release资产改动。

本计划不会清理其他change、重写旧归档或删除本机验收原始证据。项目正式ADR/context尚未被本次候选替换。

## 待确认

需要确认的具体操作：移动1个change、改写18份知识目标、删除18份重复版本，以及上文列出的状态/现行引用更新与文档收尾提交。

就计划中的归档与永久知识目标而言：**未修改任何文件。此为 dry-run 计划，请确认后执行。**

确认门来自 `speculo/skills/archive-and-consolidate/SKILL.md`：“预执行完整计划 → 用户显式确认 → 执行”；该技能明确不得将初始“完成后清理”视为这份具体计划的确认。
