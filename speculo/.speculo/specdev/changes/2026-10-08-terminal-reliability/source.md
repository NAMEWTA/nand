---
schema_version: 1
artifact: "source"
change: "2026-10-08-terminal-reliability"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/135"
captured_at: "2026-10-09T03:57:00.257Z"
content_sha256: "9b6e7b2496fdaf64c0cdf5646170072024e22ad2b3a5a647f1a030779cf26860"
remote_state: "open"
close_capability: "supported"
---

# Source: #135 [回归][终端] main 已是 1.0.0，但 1.0.0 Release 不存在：nand-pty 下载 404，Shell 和所有智能体会话都打不开；提示误导为「检查网络」

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T14:34:39Z / 2026-10-08T14:34:39Z
- Labels: ["bug","priority:P1","regression","severity:S2"]
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:57:00.257Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 9b6e7b2496fdaf64c0cdf5646170072024e22ad2b3a5a647f1a030779cf26860。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content

**严重程度 / Severity**：S2（严重）｜**建议优先级 / Priority**：P1｜**复现率 / Frequency**：3/3｜**类型**：缺陷（回归，发布产物）

## 问题概述 / Summary
main 上的插件版本已经是 **1.0.0**，终端改用新的 `nand-pty` 组件，下载地址按插件版本拼成：
`https://github.com/NAMEWTA/nand/releases/download/1.0.0/nand-pty-linux-x64`（和 `.sha256`）。

但仓库目前**没有 1.0.0 的 tag 或 Release**，只有 `0.0.1-alpha1`。两个地址都返回 **404**，所以从 main 安装后，**AI Agent 里的 Shell / 各智能体会话全部打不开**。

另外，提示文字是「The terminal helper is not available: the download failed; **check the network** and try again」。实际是 HTTP 404，不是网络问题，用户会被误导。控制台里也没有记录具体的 URL 和状态码，不好排查。

上一个测试节点 `b469379` 的终端开箱即用（从 0.0.1-alpha1 下载 `rust-terminal-servers`，sha256 一致），所以这是**回归**，和 #106 是同一类问题。

## 复现步骤 / Steps to reproduce
1. 用 main `21f852b` 构建的 `main.js / manifest.json / styles.css` 装进全新测试库，信任并启用 NAND
2. 打开工作台 → AI Agent → 点「Shell」
3. 看右上角提示；查看插件目录下的 `binaries/`

## 期望结果 / Expected behavior
- 终端组件能下载、校验，Shell 能打开；或者 main 的版本号在 Release 发布前不指向一个不存在的 Release
- 下载失败时，提示能区分「网络不通」和「服务器返回 404（这个版本的组件还没发布）」，并在控制台记录 URL 和状态码

## 实际结果 / Actual behavior
- `curl -L …/releases/download/1.0.0/nand-pty-linux-x64` → 404；`.sha256` → 404
- 提示「the download failed; check the network and try again」，`binaries/` 目录没有生成，控制台没有相关日志
- 点 3 次，3 次都一样

![404](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r24-05-terminal-helper-404.png)

## 建议
- 发布 1.0.0 Release（含 `nand-pty-<平台>-<架构>` 和 `.sha256`）；或者在发布前，让 main 的下载基址指向已经发布的版本
- `agent.helper.http` 的提示里带上状态码（例如 404 时说明「这个版本的终端组件还没有发布」），并 `console.warn` 出 URL

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `21f852b`（main，2026-10-08 22:04 UTC+8，"Document git sync, record the issue follow-ups and their acceptance (#124, #134)."） |
| 版本 / Version | manifest `1.0.0`；远端 tag / Release 只有 `0.0.1-alpha1` |
| 应用 / App | Obsidian 1.13.7（Linux x64）；插件语言 English（跟随 Obsidian） |
| 测试环境 | 全新测试库 + 全新配置目录，只启用本插件 |
| 测试时间 / Time | 2026-10-08 22:33–22:36 UTC+8 |

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 24 轮｜测试节点 `21f852b`｜2026-10-08 UTC+8</sub>


## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
