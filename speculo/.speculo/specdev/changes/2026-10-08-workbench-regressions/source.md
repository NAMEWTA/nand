---
schema_version: 1
artifact: "source"
change: "2026-10-08-workbench-regressions"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/138"
captured_at: "2026-10-09T03:56:52.731Z"
content_sha256: "22534f4a2a7b06571bba3f7814eb3862d4c8114e16c366498fdd750c38e6e681"
remote_state: "open"
close_capability: "supported"
---

# Source: #138 [工作台] medium 布局下侧栏以覆盖层打开时，点图标栏的其他模块只会关闭覆盖层、不会切换页面（遮罩盖住了图标栏）

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T14:54:46Z / 2026-10-08T14:55:14Z
- Labels: ["bug","severity:S3","priority:P3"]
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:56:52.731Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 22534f4a2a7b06571bba3f7814eb3862d4c8114e16c366498fdd750c38e6e681。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content

**严重程度 / Severity**：S3（一般）｜**建议优先级 / Priority**：P3｜**复现率 / Frequency**：4/4｜**类型**：缺陷（交互）

## 问题概述 / Summary
工作台在 medium 宽度时（例如 1280 宽窗口、Obsidian 左侧栏展开），第 ② 栏侧栏以覆盖层的形式打开。这时**点图标栏里的其他模块图标（首页 / 档案 / 自动化…）只会关闭覆盖层，不会切换页面**，要再点一次才能过去。

文档 `docs/workbench.md` 写的是「点击其他图标回到那个模块上次打开的位置」。

## 复现步骤 / Steps to reproduce
1. 窗口 1280×740，Obsidian 左侧文件栏保持展开，打开工作台 →「设置」
2. 点页头左侧「切换导航栏」（或再点一次「设置」图标），侧栏以覆盖层打开
3. 点图标栏里的「档案」图标

## 期望结果 / Expected behavior
直接切到「档案」（同时关闭覆盖层）。

## 实际结果 / Actual behavior
覆盖层关闭，页面还是「设置 · 外观」；再点一次「档案」才切过去。点「首页」「自动化」结果一样（4/4）。

![overlay](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r24-15-overlay-rail-click.png)
（左：覆盖层打开时点红框里的「档案」图标；右：点击后的结果）

## 原因（推断）
`src/shell/styles/shell.css` 中 `.nand-shell > .nand-shell-scrim { position: absolute; inset: 0; z-index: var(--nand-z-overlay) }` 把遮罩铺满了整个外壳，**图标栏也被盖住**。所以点击落在遮罩上，只触发 `onClick={() => setOverlay(false)}`（`Shell.tsx:191`），图标栏的 `selectRail` 没有收到点击。medium 布局下遮罩大概应该从 `--nand-rail-width` 开始（和 `.nand-shell-overlay--medium` 一致），或者点击图标时同时关闭覆盖层并导航。

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `21f852b`（main，2026-10-08 22:04 UTC+8） |
| 版本 / Version | nand `1.0.0`（本地构建，产物与仓库一致） |
| 应用 / App | Obsidian 1.13.7（Linux）；窗口 1280×740，Obsidian 左侧栏展开（工作台为 medium 布局） |
| 测试环境 | 全新测试库 + 全新配置目录，只启用本插件 |
| 测试时间 / Time | 2026-10-08 22:40–22:50 UTC+8 |

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 24 轮｜测试节点 `21f852b`｜2026-10-08 UTC+8</sub>


## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
