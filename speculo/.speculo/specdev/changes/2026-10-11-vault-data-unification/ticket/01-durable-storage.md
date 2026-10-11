---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills：dev 适用全部实现，ui 适用内容/浏览器/账号界面及验收。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"implement-and-verify","inputs":["本票合同、真实源码与定向差异"],"outputs":["实现、定向验证与 Evidence"],"required":true,"on_failure":"block-ticket"}]
resource_claims: ["current-workspace:root"]
artifact: "ticket"
change: "2026-10-11-vault-data-unification"
id: "T-01"
title: "连续保存与故障恢复"
status: "in_progress"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及公共持久化、数据迁移、身份隔离或发布；用户已批准完整计划及实施。"
ready: true
risk: "high"
blocked_by: []
contract_ids: ["AC-001"]
owner: "root"
expected_changes: ["<Path>src/shared/**</Path>","<Path>src/app/settings/**</Path>","<Path>src/modules/notifications/**</Path>","<Path>src/modules/automations/**</Path>","<Path>src/modules/news/**</Path>","<Path>src/modules/agent/**</Path>","<Path>scripts/verify-reliability.ts</Path>","<Path>src/modules/home/services/appearance-presets.test.ts</Path>","<Path>scripts/bundle-budget.json</Path>","<Path>main.js</Path>"]
writable_paths: ["<Path>src/shared/**</Path>","<Path>src/app/settings/**</Path>","<Path>src/modules/notifications/**</Path>","<Path>src/modules/automations/**</Path>","<Path>src/modules/news/**</Path>","<Path>src/modules/agent/**</Path>","<Path>scripts/verify-reliability.ts</Path>","<Path>src/modules/home/services/appearance-presets.test.ts</Path>","<Path>scripts/bundle-budget.json</Path>","<Path>main.js</Path>"]
read_only_paths: []
shared_paths: ["<Path>src/shared/**</Path>","<Path>src/app/settings/**</Path>","<Path>src/modules/notifications/**</Path>","<Path>src/modules/automations/**</Path>","<Path>src/modules/news/**</Path>","<Path>src/modules/agent/**</Path>","<Path>scripts/verify-reliability.ts</Path>","<Path>src/modules/home/services/appearance-presets.test.ts</Path>","<Path>scripts/bundle-budget.json</Path>","<Path>main.js</Path>"]
shared_path_owners: ["<Path>src/shared/**</Path> => root","<Path>src/app/settings/**</Path> => root","<Path>src/modules/notifications/**</Path> => root","<Path>src/modules/automations/**</Path> => root","<Path>src/modules/news/**</Path> => root","<Path>src/modules/agent/**</Path> => root","<Path>scripts/verify-reliability.ts</Path> => root","<Path>src/modules/home/services/appearance-presets.test.ts</Path> => root","<Path>scripts/bundle-budget.json</Path> => root","<Path>main.js</Path> => root"]
---

# T-01 连续保存与故障恢复

先读取总体 Map <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/tickets-map.md</Path>，再读取其适用项目 Skill，最后读取本票；Skill 矩阵是最低要求。

## 1. 战略与来源

来源：2026-10-11 用户批准的新计划及 issue #151/#148。基线 239a16a181dbd3fbdedff35eeeac84aba05707d1。目标：编辑基线与提交结果显式化；外部新增、修改和删除在后续保存中保持；排队编辑不会被旧回调覆盖；备份保存最近有效磁盘版本，故障后可恢复。

## 2. 决策状态

已锁定：所有 NAND 管理数据以当前 vault/.nand 为根；设备专属文件仍在其中；浏览器跨设备允许重新登录；本轮 Windows 验收。未决问题：无。

## 3. 范围边界

IN：连续保存与故障恢复。REUSE：当前模块、工作台和 Adapter 接口。OUT：无关界面改版、修改插件 ID、搬迁普通笔记及改写旧归档。

## 4. 要构建什么

从当前模块入口完成目标操作，重启后内容与身份仍正确；失败状态可见且可恢复。

## 5. 实现契约

接缝：JsonStore 与真实 SettingsStore 接线。输入为当前模块操作和已有数据，输出为可重新加载的正确状态。失败必须显式报告并保留可恢复数据，不能静默回退库外目录。兼容窗口为旧数据迁移至新路径并完成校验之前；仅在调用点迁移及验证通过后收缩旧接口。

## 6. 执行路线

1. 核对接缝与旧调用方，建立会因目标缺陷失败的定向测试。
2. 实现上述行为及错误路径，保留模块和资源生命周期。
3. 迁移消费者，运行定向测试和类型检查。
4. 完成双轴审查、适用回归与真实宿主验收，记录结果。

## 7. 路径访问契约

可写范围以 frontmatter 为准；当前工作区只有 root 写入，其他票按 Map 串行调度。迁移使用发现、复制、校验、切换和清理清单；写失败保留来源与恢复副本。检测越界、归属冲突、实际行为不符合合同则停止该分支并修订合同。不得因测试失败删断言或降低质量门禁。

## 8. 验证矩阵

| 行为 | 验证 | 预期 |
|---|---|---|
| 正常及回归 | pnpm vitest run src/shared src/modules/notifications src/modules/automations src/modules/news src/modules/agent | 目标合同全部通过 |
| 错误和边界 | 在上述接缝注入对应读写/外部状态失败 | 无静默数据丢失或跨范围副作用 |
| 集成 | 类型检查、build、lint；最终完整 CI | 同一提交可复现 |

E2E disposition: not-required：本票以存储集成或文档校验验证，Windows 总体验收由 T-08 执行。
E2E owner/environment: root / current-workspace。提交已获用户授权；implementation commit、direct-parent 的 result SHA 与 Evidence 由 root 记录。

## 9. 发布、迁移与恢复

迁移为复制、校验、切换、验证后清理；失败保留来源和恢复副本。收缩仅在旧调用点为零且验证通过后进行。提交、push、发布与归档来自本轮已批准计划，Windows 实测完成前不关闭 issue。

## 11. SKILL 调用计划

按绑定执行 dev 的分区、持久化、构建和测试规则；涉及界面时执行 ui 的工作台原语与宿主验收。失败阻塞本票。批准点来自用户“非常棒，现在请你执行这份计划”；发布、close 与归档限于该获批计划。

## 10. 验收标准

- [ ] AC-001：编辑基线与提交结果显式化；外部新增、修改和删除在后续保存中保持；排队编辑不会被旧回调覆盖；备份保存最近有效磁盘版本，故障后可恢复。
- [ ] 非空实现、验证和双轴审查事实写入 <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/evidence/T-01.md</Path>。
- [ ] 实际路径、Skill 摘要、命令结果、未验证范围与 Map 一致。

## 12. 停止、检查点与交付

记录 HEAD、写集和每次验证结果。遇到契约失效或失败则保留证据和可恢复数据，解决后重跑；完成后记录 implementation commit 和 direct-parent result，不将未执行的步骤写为通过。
