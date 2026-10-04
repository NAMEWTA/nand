# 未关闭 Issue 修复验收执行记录

## 范围、基线与状态

执行依据：用户批准的《NAND 未关闭 Issue：全面核查与解决实施计划》（2026-10-04，T01–T33），不是重新制定一套修复方案。

本轮起点为 `3cf0c32c78b1eadfdd51cee306246d111dbbe4a3`，已包含 #115 的修复和 #116 的附件核心。九项 Issue 是 #97、#98、#99、#106、#107、#109、#110、#111、#112。#108 的不迁移决定不变。本次不改生产源代码、`main.js`、版本、依赖或现有 workflow，不新增 AI 写作，也不删除已有终端 Agent。

**交付状态：验收基础补丁与可运行脚本；尚未完成九项原生验收、发布和关单。** [逐任务进度](issue-repair-progress.md)保留全部原任务和真实状态。本轮未连接 Obsidian 实机；已有 PR 的原生结果仍属于其原提交，不能当成本轮重新运行。

基础事实与独立离线验证见 [机器可读记录](issue-repair-evidence.json)。新 PR 的 CI 结果以该 PR 中明确指向最终 HEAD 的运行链接为准，不把基线 CI 写成新提交的结果。

## 本次实现

| 文件 | 责任 | 对应计划 |
|---|---|---|
| `scripts/obsidian-acceptance/issue-fixture.mjs` | 只读部署核验、明确路径、profile 互斥、限定文件恢复、系统 shell 与端点检查 | T06/T07 |
| `scripts/obsidian-acceptance/terminal-repair.mjs` | 双语同实例 404 重试、手动二进制修复、0/4/0 能力隔离、真实会话命令选择、运行清理及恢复 | T07/T08（一个入口）/T11/T18/T19（部分） |
| `scripts/obsidian-acceptance/issue-seed.mjs` | 真实习惯服务创建两条习惯、打卡记录、稳定 ID 和字节哈希基线 | T05（准备代码） |
| `scripts/obsidian-acceptance/issue-startup.mjs` | 不重载插件，验证本次启动后的习惯 ID、记录和原文件 | T16（检查代码） |
| `scripts/regressions/issue-acceptance.mjs` | 独立的 Node 合同及真实本地 shell/端点检查 | T06/T07/T24 |
| `scripts/run-safety-regressions.mjs` | 接入现有 `test:safety-regressions`，由 `test:all` 执行 | T24 |

这些辅助函数只被验收脚本使用，不进入生产包，不是新的领域框架。平台判断和文件操作仅用于测试宿主。

## 执行前提：先证明目标是隔离测试环境

由操作者准备独立 profile 与 Vault，沿用项目已有的 `.nand-e2e-isolated.json` marker（`kind: nand-windows-e2e`、随机 nonce、绝对 vaultPath）。脚本**不自动创建 marker、不把日常库标记为测试库**。名字中的 Windows 是历史约定，不代表测试平台。

从干净、已提交的候选工作树构建，将候选 `main.js`、`manifest.json`、`styles.css` 部署到该隔离 Vault；随后完全退出并重新启动该隔离 Obsidian。部署磁盘哈希不能证明运行内存中已重新加载，不能省略这次重启。

脚本依次验证 marker/nonce、规范化后的 Vault/profile、部署目录在目标 Vault 内、实际系统与宿主版本、本地和部署三件文件哈希、指定 main 哈希、工作树 HEAD 与干净的已跟踪文件。全部通过后才取 profile 锁，创建证据目录或操作服务。它不会访问另一个 profile，也不会抢走现有锁。其他旧 GUI 验收脚本没有此锁，仍必须人工串行执行。

普通终端、已有用户 Agent 会话必须为空；停用全部已认证 provider 配置。终端修复脚本只启动受控系统 shell，即使使用 `agentId: codex` 标记测试能力注入，也不调用 Codex 或其他模型。测试不输出浏览器 token。

### Bash 示例（Linux）

以下路径和 nonce 必须替换为操作者已创建且授权的隔离资源，不要复制成日常库路径。

```bash
export NAND_ALLOW_BROWSER_E2E=1
export NAND_WINDOWS_E2E_NONCE='<existing-isolated-marker-nonce>'
export NAND_ACCEPTANCE_VAULT='/absolute/isolated-vault'
export NAND_ACCEPTANCE_PROFILE='/absolute/isolated-profile'
export NAND_ACCEPTANCE_DIR='/absolute/evidence'
export NAND_EXPECT_MAIN_SHA="$(node -e "process.stdout.write(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('main.js')).digest('hex'))")"
# 已运行的独立 Obsidian 必须使用项目既有 CDP 启动方式。
export NAND_CDP_URL='http://127.0.0.1:9237'
node scripts/obsidian-acceptance/issue-seed.mjs
```

### PowerShell 示例（Windows）

```powershell
$env:NAND_ALLOW_BROWSER_E2E = '1'
$env:NAND_WINDOWS_E2E_NONCE = '<existing-isolated-marker-nonce>'
$env:NAND_ACCEPTANCE_VAULT = 'C:\absolute\isolated-vault'
$env:NAND_ACCEPTANCE_PROFILE = 'C:\absolute\isolated-profile'
$env:NAND_ACCEPTANCE_DIR = 'C:\absolute\evidence'
$env:NAND_EXPECT_MAIN_SHA = (Get-FileHash .\main.js -Algorithm SHA256).Hash.ToLowerInvariant()
$env:NAND_CDP_URL = 'http://127.0.0.1:9237'
node scripts/obsidian-acceptance/issue-seed.mjs
```

Windows 使用系统 PowerShell（无用户 profile），Linux/macOS 使用 `/bin/bash --noprofile --norc`。本轮本地只执行 Linux 分支；Windows 自动测试与 Windows Obsidian 原生测试要分别记录。iOS/Android 不运行原生终端验收。

## T05/T16：习惯种子与真实启动检查

`issue-seed.mjs` 要求已经有隔离 marker、没有旧种子 marker、习惯集合为空且服务 `readyForEdits`。它通过 `addHabit` 和 `markDoneMany` 创建 `Read 20 pages`、`Exercise 10 minutes`，使用固定测试日期 `2026-10-04`，等待真实存储 flush，保存 IDs、打卡记录和 Markdown 字节哈希。测试日期不是当前日期。失败时保留部分证据和已写入的测试数据，不清空后自动重试。

它故意保留 `.nand-open-issue-seed.json` 及两条测试习惯，供后续独立启动使用。准备成功不算验收成功；不在真实库执行、不自动覆盖旧 baseline。

每次**独立完成应用退出和重启**后运行：

```bash
node scripts/obsidian-acceptance/issue-startup.mjs
```

该脚本不禁用/启用插件、不修改习惯来让它们出现。检查固定 ID/名称、打卡记录及文件哈希，记录运行 PID、uptime 和部署身份。标题只作诊断信息，不算 #99 测试。

T16 需要十次独立启动；每次记录受控应用进程退出、重新启动的身份/创建时间与该次 `startup.json`，并最终检查旧进程不再运行。反复对同一个进程执行命令不能得到十次重启证据，脚本结果明确标记 `restartProof: not-asserted`。本 PR 没有运行这些原生步骤。

慢索引、外部修改/删除/重命名、加载期间编辑、冲突和重复 ID 仍按原计划 T17 独立执行，不能用字节保留检查替代。

## T06/T07/T11/T18：终端故障与能力边界

除公共环境变量外，指定**与候选协议匹配、已独立校验的**服务文件和可信预期 SHA256：

```bash
export NAND_ACCEPTANCE_BINARY='/absolute/verified/rust-terminal-servers-linux-x64'
export NAND_ACCEPTANCE_BINARY_SHA256='<sha256-from-verified-release-or-build-record>'
node scripts/obsidian-acceptance/terminal-repair.mjs
```

```powershell
$env:NAND_ACCEPTANCE_BINARY = 'C:\absolute\verified\rust-terminal-servers-win32-x64.exe'
$env:NAND_ACCEPTANCE_BINARY_SHA256 = '<sha256-from-verified-release-or-build-record>'
node scripts/obsidian-acceptance/terminal-repair.mjs
```

预期 SHA 不应在未验证文件来源时简单地对同一文件现算后自我认证。脚本只检查与预期值一致，不伪称能独立证明下载供应链来源。

运行配置：浏览器模块开启、终端 online 模式、当前零会话、所有真实 provider 停用。故障测试第一次取得服务时可能需要已经安装的可信兼容服务，因此这不是全新下载测试。

流程：

1. 完成只读部署校验及准入，再取得服务并停止本测试接管的空闲 manager。
2. 只保存当前插件 `binaries/` 中精确计算的服务文件和版本缓存的字节、权限及时间戳；不备份整个库。原文件副本放进本次新证据目录。
3. 仅当前 downloader 使用本机受控 404 端点。英文和中文各重试两次，检查本地化及一条错误提示。
4. 打开受控校验端点，将独立验证的正确文件放回，确认同实例 `ensureServer` 握手成功、提示消失，不重载插件。
5. 恢复 downloader URL，创建普通 shell、Agent 标记 shell、普通 shell，结果应为 `0/4/0`。命令回显不能被误解析为计数；只记录计数。
6. 从真实 quick-switch 命令打开，输入指定会话 ID，选择并校验实际 active leaf 的会话 ID。这补了 T08 的终端入口，不代表其他六个业务入口完成。
7. 关闭浏览器模块，检查该次运行目录消失、端点不再接受连接，已引用附件仍在。Unix socket 与 Windows Named Pipe 都使用连通性断言。
8. 无论成功失败均恢复 downloader 方法、停止本次创建的会话、停止 manager，随后恢复那两个原文件及时间戳、语言和浏览器状态。停止失败时不覆盖可能还在执行的文件；保留原始备份并报告失败。
9. 清理和释放锁后才写最终通过报告，清理失败绝不能生成 `passed: true`。

未知用户文件、其他 Vault 和活跃运行不属于此脚本的删除范围。测试生成的引用附件有意保留用于后续生命周期测试；不要以“目录为空”为由删除它们。

## T10：线上下载独立执行，不能被故障夹具替代

使用现有生产 smoke check，先完整读取其前置条件：

```bash
node --experimental-strip-types --import ./scripts/register-ts-hooks.mjs scripts/verify-terminal-release-download.mjs
```

它是明确联网的 Linux 验证，不属于 offline `test:all`。之后仍需在目标平台的真实隔离安装中验证 PTY、协议、错误恢复。不能预放二进制绕过默认下载而宣称 T10 通过。本轮没有重新运行线上下载。

## 九项验收与关闭矩阵

| Issue | 现有实现/自动化入口 | 尚须记录的原生/交付结果 |
|---|---|---|
| #97 | `verify-issue-regressions.ts`：ID 集合、命令/回调对象、订阅以及后续 composer 断言 | 当前主分支完整日志已核对；关闭评论草稿见下节，尚未实际关单 |
| #98 | `core/comments`、`platform/obsidian/comments/store-handoff.ts`、`test:editor-comments` | Windows 十次删除立即重载，卡片/index/sidecar/journal 与正文一致；慢写失败与代际取消 |
| #99 | `platform/obsidian/workspace-title.ts`、`issue-titles.mjs` | 六种 view type、两个窗口、自定义标题、后台不激活、完整重启；保留原视图标识 |
| #106 | 下载器、错误/通知、`binary-downloader.test.ts`、online smoke、terminal-repair | 五平台资源对应、默认安装真实握手、双语重试/修复；新发布包交付 |
| #107 | `localized-picker-contract.test.ts`、`open-issues.mjs` 原生构造 smoke | 七个真实上层入口与保存回写；本次只加强终端会话指定选择 |
| #109 | `BrowserPanel.tsx`、`plugin/ribbon.ts`、browser/Open Issues 脚本 | 点击与快捷键查找、重开/输入/Esc/IME、双窗口、浅深主题和 ribbon |
| #110 | 环境过滤、`runtime-files.ts`、browser/safety tests、terminal-repair | 0/4/0、普通原生服务、停用/退出/卸载/崩溃后恢复、其他运行及引用附件不误删 |
| #111 | `SaveStatus.tsx`、习惯/番茄钟的 `showSaved=false`、`test:card-panels` | 背景图、保存中、失败/冲突/重试均可读；其他产品保持原成功态 |
| #112 | HabitService、MarkdownCollectionStorage、DurableState、reliability tests | 十次真实启动和 T17 的外部/并发/加载中操作；不能用 plugin reload 代替 |

七个 #107 入口分别是终端切换、联系人关系、所属企业、上下文文件、自动化会话、快捷笔记图标和外观背景。旧的原生构造 smoke 保留，但不等于按钮路由、保存后重开、取消不改变旧值的端到端证据。

## #97 关闭评论草稿（未发送）

当前 main `3cf0c32c78b1eadfdd51cee306246d111dbbe4a3` 已使用明确的 shell 命令 ID 集合，并验证语言切换不改变命令对象/回调、保持一命令一订阅。合并后工作流 [37190060655](https://github.com/NAMEWTA/nand/actions/runs/37190060655) 三个作业完成，Linux Node 22 的 job `111400186045` 日志包含：

```text
verify-issue-regressions: default-name localization, edit intent, composer, language lifecycle and settings persistence passed
{"total":56,"passed":56,"failed":[]}
```

因此原固定数量断言已不阻断后续 composer 测试。该结论是 Node 自动化回归结论，不包含 Windows Obsidian GUI。本轮不重复修改命令实现；在维护者执行关闭操作时，以 `completed` 并注明实际发布状态。新的验收 PR CI 需独立引用，不能以此旧 run 代替。

## 回归、记录与发布顺序

现有 `test:safety-regressions` 自动运行新增验收合同，不新增 package script 或 workflow。候选需运行 `pnpm install --frozen-lockfile`、`pnpm run build`、`git diff --exit-code -- main.js`、`pnpm run lint`、`pnpm run test:all`。仓库基线 main 的 lint 是 **0 errors / 150 warnings**，不得把 #115 单独分支的 149 warnings 当成本轮主分支值；本次不趁机修改无关生产文件。

任何原生失败先区分测试脚本错误和真实生产失败，再按既有层次最小修改；没有新的生产复现时不发明修复。新 PR 只申请审查，不自行合并。未完成项留在此 change，不移动成已验收归档。

合并、版本选择、发布、安装验证、逐项关闭分别对应原计划 T28–T33。本轮只提交 PR，不推标签、不修改旧 Release、不擅自把九项 Issue 关闭。当前 `0.0.1-alpha1` 标签指向 `3c44be3...`，新 main 的后续修复必须通过新的、未占用版本交付，不能因版本字符串相同就宣称旧包已包含全部修复。
