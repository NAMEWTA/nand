---
schema_version: 1
artifact: "source"
change: "2026-10-08-browser-ai-workbench"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/142"
captured_at: "2026-10-09T03:56:48.709Z"
content_sha256: "b93d829757759d03199be5be9020c466474754c680bc5ffb651568b6a3e5510c"
remote_state: "open"
close_capability: "supported"
---

# Source: #142 [浏览器] 焦点在地址栏时 Ctrl+F / Ctrl+L 没有反应（被 Obsidian 默认热键吃掉），与文档不符

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T15:12:34Z / 2026-10-08T15:12:34Z
- Labels: ["bug","severity:S3","priority:P3"]
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:56:48.709Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 b93d829757759d03199be5be9020c466474754c680bc5ffb651568b6a3e5510c。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content

**严重程度 / Severity**：S3（一般）｜**建议优先级 / Priority**：P3｜**复现率 / Frequency**：3/3（地址栏）；网页内 0/2｜**类型**：缺陷（快捷键）

## 问题概述 / Summary
`docs/browser.md` 写的是「`Ctrl/Cmd+L` 聚焦地址栏，`Ctrl/Cmd+F` 打开并聚焦查找栏」。

实际上，**焦点在地址栏（或浏览器工具栏）时按 Ctrl+F 没有任何反应**，查找栏不出现，接着输入的文字进了地址栏。Ctrl+L 同样没有反应。只有焦点在网页内容里时这两个快捷键才有效。

用户最常见的操作就是刚输完网址、焦点还在地址栏时按 Ctrl+F。

## 复现步骤 / Steps to reproduce
1. 工作台 →「浏览器」，在地址栏输入 `example.com` 回车
2. 再点一下地址栏（焦点在地址栏），按 **Ctrl+F**
3. 输入 `domain`

## 期望结果 / Expected behavior
按文档：查找栏打开并获得焦点，`domain` 输进查找框。

## 实际结果 / Actual behavior
- 查找栏没有出现；`domain` 被追加到地址栏，变成 `https://example.com/domain`（截图 ①）
- 先点一下网页内容再按 Ctrl+F：查找栏正常打开并聚焦，回车后 1/2 并高亮（截图 ②）；Esc 关闭并回到网页，也正常
- 工具栏「页内查找」按钮正常

![ctrlf](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r24-17-browser-ctrlf-address.png)

## 原因（推断）
`src/modules/browser/ui/BrowserPanel.tsx:122-132` 把 Ctrl+L / Ctrl+F 的处理挂在面板容器的 `keydown` 冒泡监听上。但 Obsidian 自带的默认热键 `Mod+F`（`editor:open-search`）和 `Mod+L`（`editor:toggle-checklist-status`）会在更早的阶段把这两个按键吃掉。

在 document 上加 capture 监听实测：按 Ctrl+F 时只收到 `Control` 一个 keydown，`f` 从没到达，所以面板的监听器收不到。网页内能用，是因为 webview 里由 `guest-policy.ts` 的 `before-input-event` 单独处理。

可能的修法：用视图的 `Scope`（`this.scope.register(['Mod'], 'f', …)`）注册，或者在工作台浏览器页激活时接管这两个热键。

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `21f852b`（main，2026-10-08 22:04 UTC+8） |
| 版本 / Version | nand `1.0.0`（本地构建，产物与仓库一致） |
| 应用 / App | Obsidian 1.13.7（Linux），窗口 1280×740，默认热键未改 |
| 测试环境 | 全新测试库 + 全新配置目录，只启用本插件 |
| 测试时间 / Time | 2026-10-08 23:08–23:12 UTC+8 |

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 24 轮｜测试节点 `21f852b`｜2026-10-08 UTC+8</sub>


## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
