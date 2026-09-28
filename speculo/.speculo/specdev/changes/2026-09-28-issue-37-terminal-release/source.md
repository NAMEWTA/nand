---
schema_version: 1
artifact: source
change: 2026-09-28-issue-37-terminal-release
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/37
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: cdb154ccc356382567f08c1133375b4eda01318b401149aa3d0b207bb6c9964c
remote_state: open
close_capability: supported
---

# Source: [回归][智能体] 默认安装下每次启动后第一次打开终端都失败：「创建终端失败：启动终端失败」（0dc97e9 起，Release 终端服务未更新）

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 1 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T23:44:02Z / 2026-09-28T00:45:44Z
- Labels: [{"id": "LA_kwDOUoxLNM8AAAAC36IfOw", "name": "bug", "description": "Something isn't working", "color": "d73a4a"}, {"id": "LA_kwDOUoxLNM8AAAAC45LzyQ", "name": "severity:S1", "description": "致命：插件加载失败、崩溃 / 卡死、数据丢失或损坏、核心功能不可用且无绕过办法", "color": "B60205"}, {"id": "LA_kwDOUoxLNM8AAAAC45L0EA", "name": "priority:P1", "description": "建议下个提交就修", "color": "5319E7"}, {"id": "LA_kwDOUoxLNM8AAAAC45L0rw", "name": "regression", "description": "上个节点正常、这个节点坏了", "color": "E99695"}]
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

**严重程度 / Severity**：S1（致命）｜**建议优先级 / Priority**：P1｜**复现率 / Frequency**：4/4 必现｜**类型**：回归（上一个正常节点 `c3a2034`）

## 问题概述 / Summary
按默认方式安装（插件自动下载 Release 0.0.1 的终端服务），在 `0dc97e9` 上每次启动 Obsidian 后**第一次打开终端都会失败**：右上角提示「创建终端失败：启动终端失败」「初始化终端失败：启动终端失败」，终端标签随即消失。再点一次才能打开可用的终端；随后工作台右侧「当前库历史」一直显示「读取中…」，约 2 分钟后变成「部分历史无法读取 Error: History request cancelled」。

影响 / Impact：
- 所有按默认方式安装的用户：每次启动后第一次打开终端必失败，新工作台的历史列表、用量、导出、恢复全部不可用
- 失败的那次会留下一个没有标签的 shell 进程（打开 1 个终端，后台有 2 个 shell）
- 目前唯一的绕过办法是自己用 cargo 从源码编译终端服务并替换，普通用户做不到

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."），默认分支 `main` |
| 版本 / Version | nand 0.0.1（manifest 版本未变）；Release / tag：没有新 release，最新仍是 `0.0.1`（2026-09-25） |
| 构建 / Build | `pnpm install --frozen-lockfile && pnpm run build`（pnpm 11.1.3）；产物与仓库提交的一致：是；仓库自带测试：45/45 个 `test:*` 脚本通过 |
| 终端服务 / Server | 插件自动下载的 Release `0.0.1` 版 `rust-terminal-servers-linux-x64`（版本文件记录 0.0.1） |
| 应用 / App | Obsidian 1.13.7（Linux AppImage）；界面语言：English；插件语言：中文 |
| 系统 / OS | Debian 13，Linux 6.12；无 GPU；窗口 1280×740 |
| 测试环境 / Test env | 全新测试库 + 全新应用配置目录，只启用本插件 |
| 测试时间 / Time | 2026-09-28 06:44–06:50 UTC+8 |

## 前置条件 / Preconditions
- 全新库，已退出受限模式并启用 NAND（插件在首次打开终端时自动下载 Release 0.0.1 的终端服务）

## 复现步骤 / Steps to reproduce
1. 点击左侧功能区「打开NAND终端」
2. 观察右上角提示和终端标签
3. 再点一次「打开NAND终端」
4. 看工作台右侧「当前库历史」，等 2 分钟
5. 完全退出 Obsidian 再启动，重复第 1 步

## 期望结果 / Expected behavior
- 第 1 步：直接打开可用的终端，历史列表正常加载
- 插件更新了与终端服务之间的消息协议时，自动下载 / 提示更新与之匹配的服务；旧服务不认识的功能应当降级（例如只关闭历史面板），而不是让终端本身启动失败

## 实际结果 / Actual behavior
- 第 2 步：右上角依次提示「创建终端失败：启动终端失败」「初始化终端失败：启动终端失败」，终端标签消失（截图 1）。控制台见下
- 第 3 步：终端能打开，`echo nand-qa-$((6*7))` 输出 `nand-qa-42`；但此时后台有 2 个 shell 进程（第 1 步那次没有被结束）
- 第 4 步：「当前库历史」一直是「读取中…」，约 2 分钟后显示「部分历史无法读取 Error: History request cancelled」
- 第 5 步：重启后第一次打开仍然失败。首次启用 1 次 + 重启 3 次，共 4/4
- 换成用本提交源码编译的终端服务（`cargo build --locked --release`）后，本轮之后多次打开终端（含 4 次重启、停用再启用插件）都没有再出现这个错误，控制台 0 次；历史 111 条正常加载

## 截图与日志 / Screenshots & logs
![01-old-server-terminal-fail.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-01-old-server-terminal-fail.png)
（第一次打开终端：两条失败提示，标签已消失）

控制台 / Console（每次失败都是这 3 行）：
```text
[06:48:23] console.error: [Terminal] Init failed: Error: 消息解析失败: JSON error: unknown variant `agent_data`, expected `pty` at line 1 column 22
[06:48:23] console.error: [TerminalService] 创建终端实例失败: 启动终端失败
[06:48:23] console.error: [TerminalView] Init failed: 启动终端失败
```

## 疑似影响范围 / Suspected scope
- 模块 / 文件：`src/terminal-agent/server/`（新增 `agent-data-client.ts`，`ModuleType` 新增 `'agent_data'`）；`binary-downloader.ts` 的版本比较（按代码推断）
- 引入提交：`0dc97e9`（上一个正常节点 `c3a2034`）
- 可能一起受影响：所有平台的默认安装（Release 里 5 个平台的服务都是 0.0.1）；已安装旧服务的老用户升级插件后同样会遇到
- 相关 issue：无

## 已排除 / What I ruled out
- 全新库、全新配置目录、只启用本插件仍复现；重启后仍复现
- 离线模式开关与此无关：使用 Release 服务时离线模式关闭，自动下载的就是 0.0.1

## 建议 / Suggestions
- 发布与本提交匹配的终端服务（`docs/automation.md` 提到发布工作流会从同一提交构建五个平台的服务，但目前 Release 里没有新版本）
- 服务版本不要只跟 manifest 版本号走：协议变化时提高服务版本号或加协议版本握手，版本不匹配时自动重新下载
- 旧服务不支持 `agent_data` 时，只让历史功能报错，不影响终端本身；失败的那次要结束已经启动的 shell
- 建议补一个测试：用 Release 里的旧服务连接新插件，第一次打开终端应成功

<details><summary>深入分析 / In-depth investigation</summary>

- 按代码推断：新插件连接服务后会发送 `module: "agent_data"` 的消息（历史索引），旧服务只认识 `pty`，返回「消息解析失败: unknown variant `agent_data`」。这个错误回复刚好被当成第一次创建终端的结果，所以第一次失败、第二次成功
- `binary-downloader.ts` 用「已安装版本 === 插件 manifest 版本」判断是否需要更新；manifest 仍是 0.0.1，所以不会重新下载，也没有新 release 可下载
- 服务端 `cargo build` 需要 rustc 1.88 以上（依赖 `home@0.5.12`），rustc 1.85 编译失败；如需用户自行编译，文档里最好写明
</details>

---
<sub>🤖 由「NAND 端到端测试」（Grok Bot）在第 10 轮 E2E 测试中发现并提交｜测试节点 `0dc97e9`｜2026-09-28 UTC+8</sub>


## Source Comments

### NAMEWTA · 2026-09-28T00:45:44Z · https://github.com/NAMEWTA/nand/issues/37#issuecomment-5861383312

## CTO 决定：通过发布新的终端服务 Release 修复，插件不做旧服务兼容

**决定时间**：2026-09-28 08:45（UTC+8）
**相关节点**：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（第十轮测试节点）

### 决定内容
- 本问题的修复方式：**发布一个新的终端服务 Release**，让默认安装下载到支持 `agent_data` 的新服务。
- 插件**不增加**对旧版 0.0.1 终端服务的兼容或版本协商。继续使用旧服务的情况不在预期支持范围内。

### 下一轮验证方式
下一轮 E2E 测试会用**新 Release 的终端服务**验证（全新测试库 + 全新配置目录，走默认下载路径，不使用本地构建的服务）：
1. 启动 Obsidian 后第一次打开终端，期望直接成功，不再出现「创建终端失败：启动终端失败」
2. 工作台右侧的历史正常加载，不会一直停在「读取中…」
3. 控制台没有 `unknown variant agent_data`，也没有遗留的孤儿 shell 进程

新 Release 发布之前本 issue 保持 OPEN；下一轮不会再测试旧服务的兼容性。

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 10 轮复测｜复测节点 `0dc97e9`｜2026-09-28 UTC+8｜保持 OPEN</sub>

