---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills：dev 适用全部实现，ui 适用内容/浏览器/账号界面及验收。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"7dbefc0a07f8d8617ab95f5fc00184fb602e66a235cde5ccb4063c9d242e154f","phase":"implement","operation":"implement-and-verify","inputs":["本票合同、真实源码与定向差异"],"outputs":["实现、定向验证与 Evidence"],"required":true,"on_failure":"block-ticket"},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"implement-and-verify","inputs":["本票合同、真实源码与定向差异"],"outputs":["实现、定向验证与 Evidence"],"required":true,"on_failure":"block-ticket"}]
resource_claims: ["current-workspace:root"]
artifact: "ticket"
change: "2026-10-11-vault-data-unification"
id: "T-08"
title: "发行验收、alpha.2 发布与 A 交接"
status: "in_progress"
kind: "operations"
planning_depth: "deep"
planning_depth_reason: "涉及公共持久化、数据迁移、身份隔离或发布；用户已批准完整计划及实施。"
ready: true
risk: "high"
blocked_by: ["T-01","T-02","T-03","T-04","T-05","T-06","T-07"]
contract_ids: ["AC-008"]
owner: "root"
expected_changes: ["<Path>manifest.json</Path>","<Path>package.json</Path>","<Path>versions.json</Path>","<Path>.gitattributes</Path>","<Path>CHANGELOG.md</Path>","<Path>main.js</Path>","<Path>styles.css</Path>","<Path>scripts/**</Path>","<Path>docs/**</Path>","<Path>test/**</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.ts</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.test.ts</Path>","<Path>README.md</Path>","<Path>README.ZH.md</Path>","<Path>.agents/skills/dev/references/build-and-release.md</Path>","<Path>.agents/skills/dev/references/licensing.md</Path>","<Path>src/host/desktop/owned-permissions.ts</Path>","<Path>src/host/desktop/browser-session.ts</Path>","<Path>src/host/desktop/*.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/account-permissions.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/transcript.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/accounts.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/usage-scope.test.ts</Path>","<Path>src/modules/agent/platform/desktop/server/native-history.test.ts</Path>"]
writable_paths: ["<Path>manifest.json</Path>","<Path>package.json</Path>","<Path>versions.json</Path>","<Path>.gitattributes</Path>","<Path>CHANGELOG.md</Path>","<Path>main.js</Path>","<Path>styles.css</Path>","<Path>scripts/**</Path>","<Path>docs/**</Path>","<Path>test/**</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.ts</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.test.ts</Path>","<Path>README.md</Path>","<Path>README.ZH.md</Path>","<Path>.agents/skills/dev/references/build-and-release.md</Path>","<Path>.agents/skills/dev/references/licensing.md</Path>","<Path>src/host/desktop/owned-permissions.ts</Path>","<Path>src/host/desktop/browser-session.ts</Path>","<Path>src/host/desktop/*.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/account-permissions.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/transcript.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/accounts.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/usage-scope.test.ts</Path>","<Path>src/modules/agent/platform/desktop/server/native-history.test.ts</Path>"]
read_only_paths: []
shared_paths: ["<Path>manifest.json</Path>","<Path>package.json</Path>","<Path>versions.json</Path>","<Path>.gitattributes</Path>","<Path>CHANGELOG.md</Path>","<Path>main.js</Path>","<Path>styles.css</Path>","<Path>scripts/**</Path>","<Path>docs/**</Path>","<Path>test/**</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.ts</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.test.ts</Path>","<Path>README.md</Path>","<Path>README.ZH.md</Path>","<Path>.agents/skills/dev/references/build-and-release.md</Path>","<Path>.agents/skills/dev/references/licensing.md</Path>","<Path>src/host/desktop/owned-permissions.ts</Path>","<Path>src/host/desktop/browser-session.ts</Path>","<Path>src/host/desktop/*.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/account-permissions.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/transcript.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/accounts.test.ts</Path>","<Path>src/modules/agent/platform/desktop/agents/usage-scope.test.ts</Path>","<Path>src/modules/agent/platform/desktop/server/native-history.test.ts</Path>"]
shared_path_owners: ["<Path>manifest.json</Path> => root","<Path>package.json</Path> => root","<Path>versions.json</Path> => root","<Path>.gitattributes</Path> => root","<Path>CHANGELOG.md</Path> => root","<Path>main.js</Path> => root","<Path>styles.css</Path> => root","<Path>scripts/**</Path> => root","<Path>docs/**</Path> => root","<Path>test/**</Path> => root","<Path>src/modules/agent/platform/desktop/pty/binary.ts</Path> => root","<Path>src/modules/agent/platform/desktop/pty/binary.test.ts</Path> => root","<Path>README.md</Path> => root","<Path>README.ZH.md</Path> => root","<Path>.agents/skills/dev/references/build-and-release.md</Path> => root","<Path>.agents/skills/dev/references/licensing.md</Path> => root","<Path>src/host/desktop/owned-permissions.ts</Path> => root","<Path>src/host/desktop/browser-session.ts</Path> => root","<Path>src/host/desktop/*.test.ts</Path> => root","<Path>src/modules/agent/platform/desktop/agents/account-permissions.test.ts</Path> => root","<Path>src/modules/agent/platform/desktop/agents/transcript.test.ts</Path> => root","<Path>src/modules/agent/platform/desktop/agents/accounts.test.ts</Path> => root","<Path>src/modules/agent/platform/desktop/agents/usage-scope.test.ts</Path> => root","<Path>src/modules/agent/platform/desktop/server/native-history.test.ts</Path> => root"]
---

# T-08 发行验收、alpha.2 发布与 A 交接

先读取总体 Map <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/tickets-map.md</Path>，再读取其适用项目 Skill，最后读取本票；Skill 矩阵是最低要求。

## 1. 战略与来源

来源：2026-10-11 用户批准的新计划及 issue #151/#148。基线 239a16a181dbd3fbdedff35eeeac84aba05707d1。目标：发布 0.0.1-alpha.2；真实下载验证全新安装及旧 helper 升级；Windows专属门由2026-10-12用户取消，真实账号和其他平台据实列未验证；满足条件后关闭 #151/#148 并归档。

## 2. 决策状态

已锁定：所有 NAND 管理数据以当前 vault/.nand 为根；设备专属文件仍在其中；浏览器跨设备允许重新登录；Windows 专属验收由 2026-10-12 用户修订取消，优先编码和适用检查。未决问题：无。

## 3. 范围边界

IN：发行验收、alpha.2 发布与 A 交接。REUSE：当前模块、工作台和 Adapter 接口。OUT：无关界面改版、修改插件 ID、搬迁普通笔记及改写旧归档。

## 4. 要构建什么

从当前模块入口完成目标操作，重启后内容与身份仍正确；失败状态可见且可恢复。

## 5. 实现契约

接缝：完整 CI、真实 Release 资产与当前可用 Linux Obsidian。输入为当前模块操作和已有数据，输出为可重新加载的正确状态。失败必须显式报告并保留可恢复数据，不能静默回退库外目录。兼容窗口为旧数据迁移至新路径并完成校验之前；仅在调用点迁移及验证通过后收缩旧接口。

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
| 正常及回归 | pnpm run build && pnpm run lint && pnpm test:all && pnpm run check:bundle | 目标合同全部通过 |
| 错误和边界 | 在上述接缝注入对应读写/外部状态失败 | 无静默数据丢失或跨范围副作用 |
| 集成 | 类型检查、build、lint；最终完整 CI | 同一提交可复现 |

E2E disposition: required：当前可用 Linux 隔离 Obsidian 中验证本票接缝与重启；Windows 专属要求由 2026-10-12 用户取消。
E2E owner/environment: root / current-workspace。提交已获用户授权；implementation commit、direct-parent 的 result SHA 与 Evidence 由 root 记录。

## 9. 发布、迁移与恢复

迁移为复制、校验、切换、验证后清理；失败保留来源和恢复副本。收缩仅在旧调用点为零且验证通过后进行。提交、push、发布与归档来自本轮已批准计划，满足当前有效合同与真实交付验证前不关闭 issue；Windows 专属要求由 2026-10-12 用户取消。

## 11. SKILL 调用计划

按绑定执行 dev 的分区、持久化、构建和测试规则；涉及界面时执行 ui 的工作台原语与宿主验收。失败阻塞本票。批准点来自用户“非常棒，现在请你执行这份计划”；发布、close 与归档限于该获批计划。

## 10. 验收标准

- [ ] AC-008：发布 0.0.1-alpha.2；真实下载验证全新安装及旧 helper 升级；Windows专属门由2026-10-12用户取消，真实账号和其他平台据实列未验证；满足条件后关闭 #151/#148 并归档。
- [ ] 非空实现、验证和双轴审查事实写入 <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/evidence/T-08.md</Path>。
- [ ] 实际路径、Skill 摘要、命令结果、未验证范围与 Map 一致。

## 12. 停止、检查点与交付

记录 HEAD、写集和每次验证结果。遇到契约失效或失败则保留证据和可恢复数据，解决后重跑；完成后记录 implementation commit 和 direct-parent result，不将未执行的步骤写为通过。

### 最终A门与补充发行验证

本票负责版本/CI/真实发行下载/新装升级、issue整改核对与最终A交接；本地完成后由A执行正式知识提升和归档。整个Goal必须取得AC-007知识结果及AC-008归档结果，不把本票完成当作Goal完成。

补充实际helper验收：核对匹配缓存文件或受保护离线副本丢失POSIX执行位后仍可恢复执行权限；若反例成立，修复Helper接缝并保留官方摘要/保护回执的信任门。

发行CI发现Windows autocrlf使已生成styles.css字节增大并触发预算；本票补充.gitattributes的LF产物规则和真实Git检出回归，不提高预算、不跳过Windows CI。

第二轮 Windows CI 暴露 PowerShell Security 模块加载及短路径规范化问题；T-08 在原安全边界内修复 ACL 回读和 Electron 主进程路径比较，并统一测试夹具的规范路径。保留原始 CI 失败和真实 Windows 回归结果。
