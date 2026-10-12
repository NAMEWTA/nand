# NAND 全量 vault 数据迁移：暂停与开发交接

生成日期：2026-10-12。交接依据为用户要求暂停开发、压缩保存上下文；入口为 `speculo/commands/handoff.md`。所有路径均相对于项目根目录。本文用于接手，不替代 Spec、Ticket、Git 差异及原始验证证据。

## 1. 接手前必须知道

**用户已要求暂停。未收到用户恢复指令前，只读取交接资料，不继续实现、提交、推送、发布、关闭 issue 或归档。**

当前变更为 `2026-10-11-vault-data-unification`。T-01～T-04 已完成；T-05 已有两次实现提交，仍在实施中；T-06～T-08 尚未实施。不要把“最新代码已提交”理解为计划完成。

当前本地 `main` 的 HEAD：`40f2acabff35cf84f8e070cb53960ebcd81de664`。本轮没有推送、发版、关闭 issue 或归档。暂停前产品工作区干净；交接操作只新增本文及相邻的脱敏证据目录，未修改产品实现或 Ticket 状态。

最新完整本地检查通过 50/50，965 项测试通过、4 项跳过；新版 Windows 终端验收通过 17/17。**最新六种 Agent 账号验收重跑失败：重启后等待 Agent 页面超时。第二轮独立双轴审查也没有完成。** 这是接手后的首要剩余工作，不能用较早的 38/38 替代当前失败。

本线程 Goal 工具回读的是一个历史目标，状态已经是 complete；当前八票计划没有新建 Goal 对象。因此没有把历史 complete 目标改成 paused。这里暂停的是用户当前的开发工作，SpecDev 保留其真实未完成状态。

## 2. 冻结的目标、边界和授权

完整合同在 `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/spec.md`，总控在 `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/tickets-map.md`。接手必须保留以下用户已明确接受的决定：

- NAND 是 Obsidian 插件。**全部 NAND 管理的数据，以当前打开的 vault 下的 `.nand/` 为唯一根目录**：用户内容 Markdown、配置、身份、运行数据、浏览器 Cookie/缓存/下载/桥接、Agent 凭据/HOME/临时目录/Hook、下载的 helper 均包括在内。
- 插件加载资产依 Obsidian 安装约定保留。普通用户笔记、宿主自身数据、Git 自有元数据不做无关搬迁。不得改插件 id、重建脚手架或改为网页应用。
- 当前维护文档只保留中文，只有 README 双语。产品界面仍保留 `t()` 和 en/zh 词典。原始许可、署名及历史归档不翻写。
- 文档以当前代码和有效规范为准，删除过时重复版本，不保留无效的旧政策。ADR/context 永久知识必须经过 A 网关；不能在普通实现中直接改永久知识。
- Windows 原生 Obsidian 验收满足本轮要求。真实平台账号不可参与，保留“未验证”；macOS/Linux 也不能冒称实测通过。不要再次索要密码、验证码或真实账号。
- `.nand/` 是隐藏目录：支持隐藏目录的文件同步可同步它；Obsidian Sync 不包含点开头目录。不能承诺浏览器/CLI 登录状态跨设备必然可用，允许重新认证。
- 完成 #151 的整改、#148 的发布差异问题，最终交付 **一个 `0.0.1-alpha.2` Release**，验证通过后关闭对应 issue 并归档。
- 用户此前明确要求 commit/push，并批准完整计划的执行。当前暂停指令阻止继续开发；恢复后仍须沿原 owning Work、原远程账本及真实状态执行，本文不是新的远程授权或重放许可。

旧 `AGENTS.md`、dev 参考中仍有“可见 Markdown”“插件 binaries”“所有 docs 双语”等旧规则，T-07 尚未更新。与上述明确用户决定冲突时采用新决定，不能据旧文本把实现迁回库外。

## 3. 最小恢复读取包

正常恢复按此顺序读取，避免重读整套知识库：

1. `speculo/.speculo/workspace.json`：解析 roots；当前 state 为 `speculo/.speculo`、workflows 为 `speculo/workflows`、skills 为 `speculo/skills`。
2. `speculo/.speculo/catalog.md`、`speculo/.speculo/AGENTS.md`：只定位当前 I/审查/后续 A、T 的适用入口。
3. `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/.status.json` 与 `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/tickets-map.md`：核对 owner、状态、依赖和写集。
4. `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/spec.md`、`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/ticket/05-agent-accounts.md`。
5. `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/T-05.md`：主体含分阶段事实，最后的“运行中”由本文暂停检查点补充；不是最终通过报告。
6. 本文第 7～10 节、最新失败证据和固定源码，再恢复 I。

当前 owning Work：`speculo/workflows/specdev/I-implement/I-implement.md`。按入口需要再读 `speculo/workflows/specdev/I-implement/execution-preflight.md`、`speculo/workflows/specdev/I-implement/references/implementation-procedure.md`、TDD 与审查规则。

其他变更内权威记录：

- `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/LOG.md`：阶段日志，最后一行不是当前最终状态。
- `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/ADR.md`：变更内已确认决定；不是永久 ADR 已完成提升。
- `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/CONTEXT.md`：初始基线与授权来源。

当前变更下 **没有 source.md、triage.md、publish.md**；没有发现 `speculo/.speculo/specdev/capture.md`。没有本轮已启动的远程 close/publish 事务或待重试远程行。不要杜撰这些工件；T-08 到达相应远程动作时按 T-triage 合同建立/核对真实账本。

## 4. 仓库与不可变检查点

| 项目 | 暂停时事实 |
|---|---|
| 分支/工作区 | 当前工作区 `main`，未创建 candidate/worktree，direct-parent |
| owner | root 是产品、状态、提交、宿主验收及远程动作唯一 writer |
| HEAD | `40f2acabff35cf84f8e070cb53960ebcd81de664` |
| 最近提交 | `fix(agent): 修复账号恢复并发写入与辅助程序信任边界` |
| T-05 首轮提交 | `08a5a158e59174b69fd82383e55e4580e3454ff6` |
| T-05 固定 base / T-04 result | `f28906c91312b1da1017d33ad64770e366ecebf5` |
| 初始基线/本地 origin/main | `239a16a181dbd3fbdedff35eeeac84aba05707d1` |
| 本地领先 | `origin/main..HEAD` 有 21 个提交，尚未 push |
| 当前版本 | `manifest.json` 仍为 `0.0.1-alpha.1` |
| 产物 | `main.js` 4,682,795 字节；`styles.css` 757,462 字节 |
| 包体上限 | main 4,683,776；styles 757,760；启动和模块激活预算未放宽 |
| 暂停时产品工作区 | `git status --short` 无输出；新增本文之后应只有交接文件变化 |

不要 reset、squash、清理或重复创建这 21 个提交。恢复先核对实际 HEAD、用户新增改动和远程分支；有漂移则停止受影响写集并扩读差异。

关键输入 SHA-256，取自暂停时磁盘原文件（换行变化也会改变摘要）：

| 文件 | SHA-256 |
|---|---|
| `.agents/skills/dev/SKILL.md` | `c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6` |
| `.agents/skills/ui/SKILL.md` | `8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044` |
| `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/spec.md` | `c942f780d025cca3d60a87c5b2e7644510c60bea05e15624e8775457ffdd16e0` |
| `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/tickets-map.md` | `54878e139ecdc7bde3dd4ac88a0211abcf1a7e50c7c6733dad584f1c64fa4934` |
| `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/ticket/05-agent-accounts.md` | `85de8fb0e995228b5599b23c2a326f96c35a1f1d12951274ce645f39211f1092` |
| `main.js` | `11b7d13537e6229dad76c9baf6886142ce95d9a8763c7ca80e260b75780d3542` |

## 5. 八票进度，不需要重新开始

| Ticket | 状态 | 接手定位 |
|---|---|---|
| T-01 | done | JsonStore 编辑基线/外部修改保留/故障恢复；result `5200b0e439b620f8a11159a54f44752d9df78f49` |
| T-02 | done | vault 路径、库内设备身份与内部状态；result `ff262a6728f411bb7f96b6356bb0c124c94c31a0`；Windows 9/9 |
| T-03 | done | 隐藏内容 Adapter、索引/工作台编辑/搜索/附件/移动/链接；result `6e7197e297dc9ec23bfcad0c762b449df2abc8b0` |
| T-04 | done | 浏览器会话、下载与桥接；result `f28906c91312b1da1017d33ad64770e366ecebf5`；第五轮两轴通过 |
| T-05 | in_progress | 已实现并修复首轮审查发现；最新账号宿主验收失败、第二轮双轴未完成 |
| T-06 | ready，未实施 | Git autostash 冲突判定与 Release 同 SHA 完整门禁 |
| T-07 | ready，未实施 | 中文当前文档、删除重复旧版本、A 网关永久知识归并 |
| T-08 | ready，未实施 | alpha.2、完整 CI、真实下载新装/升级、close 与归档 |

完整旧验证分别在 `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/T-01.md`、`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/T-02.md`、`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/T-03.md`、`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/T-04.md`。这里不复制完整实施记录。

T-04 最终完整回归 50/50、940 项测试；Windows 会话 36/36、profiles 51/51、共享旧会话选择 6/6。不要读取早期段落的 24/24 就当最终覆盖只有这些。其成熟迁移做法包括主/备份终态封存、首个备份独占创建、同步回执严格冲突检测、冷启动验证、来源目录原子认领及可恢复退休。

`.status.json` 当前 `change_status=active`、`current_work=specdev/implement`，T-05 的 source_checkpoint/source_sha/result_sha 仍为 null，verification/full_suite/e2e 为 pending。这些是尚未结项的真实治理状态。HEAD 已有实现不能直接填为 done，须等本票门禁通过后登记。

## 6. T-05 当前实现导航

仅说明继续调试需要的接缝；准确代码以固定 HEAD 为准。

| 接缝 | 文件 | 当前行为 |
|---|---|---|
| 身份规则 | `src/modules/agent/core/launch/account-name.ts` | 空串是默认账号；非空 NFC/trim；拒绝控制字符、全空白及过长输入 |
| 账号环境 | `src/modules/agent/platform/desktop/agents/accounts.ts` | 稳定完整 SHA-256 身份；默认也进入 `.nand/agents/<device>/accounts/<provider>/...`；HOME、Windows/XDG、provider、temp 全部显式赋值；清空常见继承凭据 |
| Codex 存储 | `src/modules/agent/platform/desktop/agents/account-args.ts` | launch/resume/automation 强制 file 凭据与库内 sqlite_home/log_dir |
| 旧数据迁移 | `src/modules/agent/platform/desktop/agents/legacy-accounts.ts` | 插件 accounts/binaries 必须完整主进程冷启动后保留至 vault；旧有损账号名必须明确选旧目录或新身份；启用前封存 ready 主/备份 |
| 激活接线 | `src/modules/agent/platform/desktop/agents/prepare-accounts.ts`、`src/modules/agent/module.ts` | 主进程 boot 标识、防模块重载绕过、原生选择及释放 |
| 旧引用映射 | `src/modules/agent/platform/desktop/agents/legacy-references.ts` | 只采用已完成且明确选择的 binding 与来源回执；旧环境映射至新身份，多义拒绝 |
| transcript | `src/modules/agent/platform/desktop/agents/transcript.ts` | vault 根别名规范化，内部链接继续拒绝；检查账号内真实文件 |
| 当前权限/链接 | `src/host/desktop/owned-permissions.ts` | Windows ACL 使用 FileSystemInfo.SetAccessControl，仅当前用户+SYSTEM；不 SetOwner；ACL 可缓存，交付进程前子树链接每次检查 |
| 历史/标注 | `src/modules/agent/platform/history/service.ts` | 来源在 vault；逐账号失败形成 warning，不阻断其他账号；旧 title/favorite/tags 通过明确映射读取，保留旧键 |
| 用量 | `src/modules/agent/platform/desktop/agents/usage.ts` 及同目录相关 provider 文件 | 仅当前账号；不从全局 HOME/keychain 兜底；读失败显式呈现 |
| Hook | `src/modules/agent/platform/desktop/hooks/automation-hooks.ts`、`src/modules/agent/platform/desktop/hooks/settings-write.ts` | 脚本/事件目录在账号内；跨实例串行；认领实际旧设置、无覆盖发布、保留并发/中断恢复版本 |
| 生成 Hook 边界 | `src/modules/agent/platform/desktop/hooks/spool-guard.ts` | 实际写入前核对归属和祖先链接 |
| helper | `src/modules/agent/platform/desktop/pty/binary.ts` | `.nand/helpers/<device>/<platform-arch>/<version>/`；官方下载摘要、版本独立路径；开发 override 只复制到库内执行 |
| helper 回执 | `src/host/desktop/protected-receipt.ts` | Electron safeStorage 保护证明，密文仍存 vault；拒绝 Linux basic_text 作为信任依据 |
| 普通 shell/helper 环境 | `src/modules/agent/platform/desktop/pty/runtime-environment.ts`、`src/modules/agent/services/terminal/sessions.ts` | 全量库内环境；进程启动/结束生命周期；会话记录真实 HOME |
| 启动/恢复/自动化 | `src/modules/agent/services/launch/launcher.ts`、`src/modules/agent/services/agent-runtime.ts` | 从身份重算环境、旧引用映射、验证 transcript，拒绝任意恢复环境覆盖 |
| 文件链接 | `src/modules/agent/platform/desktop/files.ts`、`src/host/desktop/retained-browser-file.ts` | 普通文件优先；`~/` 使用会话 HOME；旧浏览器产物经已保留回执和摘要定位 |

重要边界：外部用户自己维护的全局 CLI homes 不自动搬走。NAND 启动的新进程使用库内身份；真实认证可能需要重新进行。历史全局 Hook/外部 CLI 的全部第三方内部行为没有被本轮真实账号验收覆盖，不要扩大“已验证”的结论。

### helper 旧回执的信任决定

旧明文 `nand-pty.json` 加上本地匹配 SHA 不能证明发布来源，可由同步文件修改者同时伪造。当前实现不会只凭这些字节离线执行旧文件：保留旧 helper，首次在线读取正式发布摘要；匹配就复制旧字节，无需重下载二进制，然后生成本机受保护回执供后续离线复用。另一设备不能解密时须重新在线核验；保护不可用时不能假装拥有离线可信证明。

这一处理需在第二轮规范轴重新确认；不能为了消除旧 helper 的 offlineMissing 直接恢复不可信明文 stamp 的执行权。Windows DPAPI 不抵抗同一 OS 用户已有代码执行权的攻击者；已修复的是仅操纵同步目录字节的缓存伪造。主依据为 [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)。

## 7. 审查状态：首轮有发现，第二轮没有结论

共同固定 base：`f28906c91312b1da1017d33ad64770e366ecebf5`。首轮 head：`08a5a158e59174b69fd82383e55e4580e3454ff6`。两个独立 reviewer 都返回 request-changes，并用固定源码隔离探针复现；没有互传 findings。

标准轴首轮：

| 级别 | 发现 | 当前修复位置/复核重点 |
|---|---|---|
| P1 | 同时伪造 helper 与明文摘要可获执行信任 | 受保护回执；伪造/异机/无保护/在线重新验证 |
| P2 | 活跃旧账号备份仍 copying，凭据更新后恢复永久失败 | ready 双封存；损坏/删除主绑定、Hook 新增文件 |
| P2 | vault junction 别名下合法 transcript 被拒绝 | 根别名规范化且不跟随内部链接 |
| P2 | 无关浏览器回执损坏阻断普通文件 | 常规文件解析优先 |
| P2 | `~/` 仍打开宿主 HOME | Session 真实 HOME 接入所有终端链接 |

规范轴首轮：

| ID/级别 | 发现 | 当前修复或待确认 |
|---|---|---|
| SF-01 medium | ready 绑定恢复成 copying | 已实现双封存，定向测试通过 |
| SF-02 high | Hook 末次读后替换丢并发设置 | 已改为认领实际版本和无覆盖发布，含失败恢复测试 |
| SF-03 medium | 未绑定旧账号阻断其他 Agent 历史 | 已按账号 warning 隔离，保留有效来源 |
| SF-04 medium | 旧环境/transcript/历史标注没有映射 | 已接入启动、自动化与 NativeHistory，拒绝多义绑定 |
| SF-05 medium | 旧 helper 迁移后离线不可用 | 已补正式摘要验证后复用旧字节；未采纳旧明文 stamp 直接离线授权，需复审确认 |
| SF-06 high | ACL 缓存后新增内部 junction 仍可启动 | 已每次检查当前子树；定向真实 FS 反例转绿 |

第二轮拟审 head：`40f2acabff35cf84f8e070cb53960ebcd81de664`。标准轴 `/root/storage_standards_review` 刚启动即被执行平台额度错误终止，**没有审查结论**；规范轴 `/root/storage_spec_review` 尚未发起第二轮，已通知用户暂停。当前没有应继续等待的 reviewer。

**审查隔离要求：本文及 T-05 Evidence 同时包含两个轴的发现，只供 lead 阅读，不能整篇传给任一新 reviewer。** 新会话如创建 reviewer，要从不继承 lead 全历史的独立上下文起步，分别只给标准或规范材料、固定 SHA、三点 diff、对应提交日志。旧 reviewer 若不可用，重建隔离包；不伪造 pass、不用 root 自审替代所需独立轴。

审查入口：`speculo/workflows/specdev/common/skills/code-review/SKILL.md`；适用来源发现、Fowler、risk-review、reviewer-contracts 均在 `speculo/workflows/specdev/common/skills/code-review/references/`。该 Skill 允许独立 reviewer；不授权实现代理并行写仓库。

## 8. 验证证据与最新失败

### 最新本地检查

固定产品实现对应当前 HEAD；首次复审修复的完整检查结果：

| 检查 | 结果 | 证据 |
|---|---|---|
| build | 退出 0，生产/测试类型及样式检查、产物重建 | `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/checks-agent/review2-build-final.log` |
| lint | 退出 0，零警告 | `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/checks-agent/review2-lint-final.log` |
| test:all | 50/50；212 文件通过、1 跳过；965 测试通过、4 跳过 | `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/checks-agent/review2-all.log` |
| check:bundle | 通过，有实际增长理由；无新依赖 | `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/checks-agent/review2-budget.log` |
| test:docs | 通过（本文创建前） | `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/checks-agent/review2-docs.log` |
| git diff --check | 产品差异检查通过 | 暂停前已实跑 |

定向红绿日志在 `scripts/tmp/`，主要为 `scripts/tmp/t05-review1-paths-red.log`、`scripts/tmp/t05-review1-paths-green.log`、`scripts/tmp/t05-review1-hooks-red.log`、`scripts/tmp/t05-review1-hooks-green.log`、`scripts/tmp/t05-review1-scope-red.log`、`scripts/tmp/t05-review1-scope-green.log`、`scripts/tmp/t05-review1-retained-red.log`、`scripts/tmp/t05-review1-retained-green.log`。另外 `scripts/tmp/t05-review1-receipt-green.log`、`scripts/tmp/t05-review1-legacy-launch-green.log`、`scripts/tmp/t05-review1-hooks-recovery-green.log` 已通过。对应回归代码已提交，临时日志不应当作新测试入口。

### Windows 终端：当前源码通过 17/17

入口：`scripts/obsidian-acceptance/terminal-reliability.mjs`；已归集证据：`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/windows-agent-terminal-review2/`。

- 一次性库实际下载 alpha.1 helper，不设置 NAND_PTY_BINARY。
- HTTP 404/503 与网络失败的语言、版本信息及 URL 脱敏；真实 shell 输入、resize、退出。
- 已安装 Codex 0.162.0 在空的库内账号启动与关闭；未做真实登录。
- DPAPI 回执解密、正式摘要对应字节、宿主重启后无网络复用。
- 同时伪造二进制和自填明文摘要被 offlineMissing 阻止；还原正确字节及回执后离线恢复。

最终成功夹具为 `scripts/tmp/agent-terminal-vault-20261011-05/`。上一轮 `scripts/tmp/agent-terminal-vault-20261011-04/` 在停止模块后立刻替换尚未退出的 helper 遇到 EBUSY；修复验收脚本等待进程退出后已重跑通过，不是完整通过的旧证据。

### Windows 六种账号：早期通过，最终重跑失败

入口：`scripts/obsidian-acceptance/agent-vault-data.mjs`。合成 CLI 经真实 ConPTY 写环境回执，验证目录归属与迁移；不是六个平台实际登录。

首轮实现验收 `scripts/tmp/agent-vault-data-20261011-03/` 通过 38/38，已归集到 `speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/evidence/windows-agent-accounts/`。

**当前 HEAD 的重跑**为 `scripts/tmp/agent-vault-data-20261011-04/`，脚本退出 1：34 条记录中 33 条通过、1 条 acceptance-failure；整体 passed=false。失败发生在脚本第 63 行：完成六 provider/default/中文标点/非法名等检查之后，执行最后一次 `runtime.restart()`，随后 `page()` 等待拥有 controller 的 `nand-agent-page` 超时。

原始失败信息：

```text
Timed out: app.workspace.getLeavesOfType('nand-workbench-view')
  .flatMap(l=>l.view.getNativeSurfaces())
  .some(s=>s.getViewType()==='nand-agent-page'&&s.controller)
at page (...agent-vault-data.mjs:16)
at ...agent-vault-data.mjs:63
```

没有完成的末尾断言包括 cold restart 后 binding、保留来源和 children exit；不能按 38/38 记为本轮通过。应用日志出现宿主 CLI 命名管道 EADDRINUSE，以及 Obsidian 自动更新 1.14.4 下载完成；**尚未确认它们与页面超时是否有关**，也尚未排除真实产品重启缺陷。不要直接扩大等待时间或删断言后宣布成功。

原始证据：`scripts/tmp/agent-vault-data-20261011-04/evidence/result.json`、`scripts/tmp/agent-vault-data-20261011-04/evidence/application.log`、`scripts/tmp/agent-vault-data-20261011-04/evidence/failure.png`、`scripts/tmp/t05-review2-accounts.log`。为避免 ignored 临时目录清理导致关键失败丢失，本次交接另保留脱敏结果和日志到 `speculo/.speculo/commands/handoff/2026-10-12-specdev-vault-data-unification-evidence/`；截图/完整测试库仍留在原 fixture。

该运行使用前述成功下载 helper 的开发复制输入，插件仍复制到本库版本目录执行。T-08 的 alpha.2 新安装/升级必须另用真实 Release 下载，不能据此代替。

所有已启动验收脚本在暂停回读时都已退出，finally 已调用 runtime.stop；CDP 端口 9249、9455 未发现监听。没有继续运行开发任务；未操作用户正常 Obsidian 进程。之后每次验收仍须使用全新、不存在的 fixture 根目录，勿在旧迁移夹具或真实用户 vault 上重跑。

## 9. 恢复后的下一安全动作

进入条件：用户明确恢复；roots、owner、HEAD 和关键输入回读一致，或已解释漂移；确认无其他 writer、旧事务或真实验收进程。

**第一个动作只调查最新账号验收的重启超时。** 输入为上述失败结果、日志、截图、固定 HEAD 的 `scripts/obsidian-acceptance/agent-vault-data.mjs` 和 `scripts/obsidian-acceptance/fresh-vault.mjs`，以及 `src/modules/agent/module.ts` 的激活路径。确认重启后实际 moduleState、错误日志、路由/页面挂载、profile 更新状态，再决定是产品故障还是夹具问题。需要新宿主证据时从全新隔离库重跑，不能在失败库中直接重放清理迁移。

之后顺序为：

1. 真实反例先失败，最小修复，定向回归及适用 build/lint/budget；保留失败证据。若只修夹具，准确说明产品未改。
2. 完成当前源码的账号 Windows 验收，保留最终结果和必要截图；不可把真实账号/其他 OS 标为已验证。
3. 固定不可变提交，执行第二轮隔离的标准轴与规范轴；范围始终从 T-05 base 三点 diff 到新 head。新的发现继续修复再固定；不能沿用旧 head 的 pass。
4. 更新 T-05 Evidence、Skill execution、实际 source/result、Ticket/Map 状态。仅在门禁全过后按 I 顺序 review→done，记录 direct-parent；不要把历史 T-01～T-04 source/result 强改成当前 HEAD。
5. 按编号串行进入 T-06，再 T-07、T-08。未完成 T-05 之前不继续生产写入 T-06。

失败停止点：存储归属冲突、迁移数据变化、路径逃逸、来源不能证明、审查失败、真实验收失败时保持 T-05 未完成，保留可恢复数据；回到原 `speculo/workflows/specdev/I-implement/I-implement.md`，不创建替代 Change 掩盖失败。

## 10. 后续三票的具体落点

### T-06 Git 与发布门禁

权威票：`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/ticket/06-git-release-gates.md`。目前只读调查过，没有实现。

- `src/modules/sync/core/repo.ts` 的 integrate 当前 merge/rebase 返回 code=0 就立即 true；autostash 应用冲突可在此漏报。成功退出后仍须检查未合并条目和 operation 状态。
- 跟进 `src/modules/sync/core/flow.ts` 的 pullStep，以及 `src/modules/sync/services/sync-service.ts` 的结果、通知、自动同步计数。保留 autostash；没有实际 merge/rebase operation 时不胡乱 abort。
- 用真实系统 Git 覆盖 ff/non-ff、merge/rebase、autostash 冲突与恢复；现有测试入口为 `test/sync/git-flow.test.ts` 和 sync 模块测试。再用 Windows Obsidian 验证状态、通知与计数。
- `.github/workflows/lint.yml` 当前 push/PR 执行 Node.js build；尚无 workflow_call。Linux 有 Node 22/24 全套，Windows 24 的检查集合与 Linux 不完全一致。
- `.github/workflows/release.yml` 当前只依赖 terminal reusable workflow，缺同一 SHA 的完整质量门禁。将完整检查复用并让 release 严格依赖同 SHA 的 checks 和 helper；失败、取消、跳过都不得发布。
- 五个平台 helper 必须继续由 CI 构建，不能本地自行编译上传替代。保证产物/源码、版本/changelog、checksums、许可证、attestation 等既有检查保留。

### T-07 当前中文文档与 A 归并

权威票：`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/ticket/07-current-docs.md`。尚未实施；不能把本交接当作永久知识更新。

范围：`speculo/.speculo/specdev/adr/`、`speculo/.speculo/specdev/context/`、`docs/`、`AGENTS.md`、`.agents/skills/`、README 双版本、CHANGELOG/SECURITY，以及相关文档校验和发布文档政策。旧粗略盘点为 ADR 26→13、context 6→3、docs 40→约 21，合计约 39 份重复文档、约 184 处链接；**这是早期盘点提示，不是强制删除数量**，须按最新代码重新核对独有信息。

当前语言规则、存储表、设备 id、同步状态、Hook/helper、浏览器路径等均需同步。只有 README 保留双语；保持产品 i18n 和许可证原文。删除重复旧规范前保留仍成立的独有信息，修复全部引用与测试期望。永久 ADR/context 仅经 `speculo/workflows/specdev/A-archive-and-consolidate/A-archive-and-consolidate.md` 所属网关，不绕开所有权或直接提升。

文档修改前备份真实原文件，记录完整前/后字符统计；删除、移动、索引与校验器一并验证。不改历史 archive，不恢复 CLAUDE.md。

### T-08 alpha.2、远程状态与归档

权威票：`speculo/.speculo/specdev/changes/2026-10-11-vault-data-unification/ticket/08-alpha2-delivery.md`。尚未实施。

顺序：完整本地检查及固定提交 → push 后检查同 SHA 的真实 CI → 正确升版本/准备发行记录并通过门禁 → 正式 alpha.2 Release 与五平台 helper → Windows 真正从该 Release 下载的新装和旧 helper 升级 → 核对 issue AC 后 close → A 归档和永久知识整理。具体版本/标签操作按项目发布 Skill，不凭本文重放未知远程动作。

暂停时只读 GitHub 核对：

- [#151](https://github.com/NAMEWTA/nand/issues/151) OPEN：存储数据丢失、Agent 账户隔离、Git 冲突误判、发布门禁整改；尚不能关闭。
- [#148](https://github.com/NAMEWTA/nand/issues/148) OPEN：alpha.1 发布内容落后；alpha.2 尚未发布，尚不能关闭。
- 最新列出的 [Node.js build 38105729115](https://github.com/NAMEWTA/nand/actions/runs/38105729115) success，对应 `239a16a181dbd3fbdedff35eeeac84aba05707d1`。这只是远程旧基线，不是当前 40f2aca 的 CI 通过证明；历史还存在失败 run。
- Release 列表只有公开预发行 [0.0.1-alpha.1](https://github.com/NAMEWTA/nand/releases/tag/0.0.1-alpha.1)。本轮没有创建 alpha.2、draft、标签或上传资产。

远程恢复入口为 T-triage publish/外部动作，归档入口为 A。若未来发现 pending-close、close-failed、publish-failed，按原账本和准确远程 locator 恢复，不能重新创建操作掩盖部分成功。

## 11. 建议 skills

| Skill / 入口 | 使用阶段与摘要 |
|---|---|
| dev — `.agents/skills/dev/SKILL.md` | 当前 T-05 及全部后续实现；模块边界、Node/Electron desktop、懒加载、设置/i18n、测试、包体、许可与发布；事实过时处按用户新决定在 T-07 更新 |
| ui — `.agents/skills/ui/SKILL.md` | 账号对话框、页面、原生 Obsidian 验收和后续受影响 UI；保留三栏工作台、原语、焦点与可访问性，不做无关改版 |
| SpecDev code-review — `speculo/workflows/specdev/common/skills/code-review/SKILL.md` | T-05 收敛及后续各票；固定 SHA、标准/规范隔离、Fowler/risk、真实定向验证；不把全量测试替代独立审查 |
| archive-and-consolidate — `speculo/skills/archive-and-consolidate/SKILL.md` | 仅在 T-07 永久知识归并或 T-08 明确归档阶段按 A 所属合同调用，不在当前 handoff 激活归档 |
| docs-sync — `speculo/skills/docs-sync/SKILL.md` | T-07 如需依据明确 Git 范围同步维护文档，先读入口并确认适用范围；不自动扩写历史 |
| computer-use（环境技能） | 仅需要 OS 级可见窗口、焦点、菜单或截图时使用；现有页面级 CDP 验收继续使用仓库脚本，不以 OS 自动化替代全部验证 |

本次手动交接只执行 `speculo/commands/handoff.md` 和其文档保真要求，没有额外激活开发、归档或远程 workflow。

## 12. 环境、脚本和容易误踩的点

- Windows PowerShell 5，Node 24.21.0，pnpm 11.1.3；从项目根运行命令。`Get-Content -Encoding UTF8` 读取源码/Markdown。
- 运行 `pnpm run build`，它含 skipLibCheck 与测试类型检查。不要用裸 tsc 触发第三方声明问题后修改依赖；不改 node_modules。
- 基础命令：`pnpm run build`、`pnpm run lint`、`pnpm run test:all`、`pnpm run check:bundle`；改文档另 `pnpm test:docs`，改 CSS/i18n/native 分别运行项目对应检查。当前测试已通过的部分不用无条件重复，依据新变更/失败决定回归。
- PowerShell `*>` 生成的旧日志常是 UTF-16LE；用相应编码读。提交的 review2 检查日志已经转为 UTF-8；旧 checks-agent 有二进制日志表现，不是空文件。
- 原生入口 `scripts/obsidian-acceptance/fresh-vault.mjs` 必须使用未存在的绝对 fixture 根目录，要求环境变量 NAND_OBSIDIAN_EXECUTABLE；开发副本验收才设置 NAND_PTY_BINARY。应重新定位本机 Obsidian/Codex 可执行文件，不把另一个人的绝对用户路径写入交接或产品。
- 只保留并检查属于自己 fixture 的进程；不能粗暴关闭用户 Obsidian 或全部 node。暂停时相关验收已停止。
- Windows ACL 已踩过两次坑：Set-Acl 对已有树触发权限问题；SetOwner 在真实宿主令牌下 UnauthorizedAccess。当前采用 SetAccessControl 并保留 owner，真实终端成功；勿无证据回退。
- 已运行的一次性编辑脚本不能当恢复命令重跑：`scripts/tmp/t05-activate.mjs`、`scripts/tmp/t05-checkpoint-evidence.mjs`、`scripts/tmp/t05-review1-evidence.mjs`、`scripts/tmp/t05-review2-budget.mjs`、`scripts/tmp/t05-review2-evidence.mjs`、`scripts/tmp/t05-review2-checks.mjs`、`scripts/tmp/t05-hook-writer.mjs`、`scripts/tmp/t05-receipt-tests.mjs`。它们可能覆写新 Evidence 或依赖旧锚点。
- 文档修改备份/统计已留在 `scripts/tmp/T-05-review2-T-05.md.bak`、`scripts/tmp/T-05-review2-counts.json`、`scripts/tmp/T-05-review2-budget-counts.json`、`scripts/tmp/T-05-review2-checks-counts.json`，以及此前 T-01～T-04/T-05 对应统计。本文新建，不替换任何旧报告。
- 没有当前 candidate 锁/事务需要释放；当前 `.status.json` active 是未完成 I 状态。不要仅因本会话暂停就释放他人资源、改旧票 SHA、强行归档或自动提交全部工作区。

## 13. 交接产物校验

本文新建前字符数为 0；写入后完整字符数见相邻脱敏证据目录的 `speculo/.speculo/commands/handoff/2026-10-12-specdev-vault-data-unification-evidence/document-check.json`。没有旧报告需备份，没有删除原始证据。该记录同时保存文档 SHA-256、路径回读和 Markdown 检查结果。

本报告保留了暂停、失败、未验证范围和剩余交付。它不宣称 Token/额度节省比例，也不把摘要作为新的执行授权。接手后先核对事实，再在用户恢复指令下继续原计划。
