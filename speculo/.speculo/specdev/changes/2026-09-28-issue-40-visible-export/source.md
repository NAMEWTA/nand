---
schema_version: 1
artifact: source
change: 2026-09-28-issue-40-visible-export
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/40
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 6e3ab7f158b3c23876b18e7f73330639c794f00cb632341f26d9eb7d91e25ddc
remote_state: open
close_capability: supported
---

# Source: [工作台] 「导出 Markdown」写到隐藏的 .nand 文件夹，Obsidian 文件列表和快速切换里都找不到

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 0 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T23:44:07Z / 2026-09-27T23:44:07Z
- Labels: [{"id": "LA_kwDOUoxLNM8AAAAC36IfOw", "name": "bug", "description": "Something isn't working", "color": "d73a4a"}, {"id": "LA_kwDOUoxLNM8AAAAC45Lz5g", "name": "severity:S3", "description": "一般：非核心功能受损，或有绕过办法", "color": "FBCA04"}, {"id": "LA_kwDOUoxLNM8AAAAC45L0cg", "name": "priority:P3", "description": "可排期", "color": "D4C5F9"}]
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

**严重程度 / Severity**：S3（一般）｜**建议优先级 / Priority**：P3｜**复现率 / Frequency**：3/3 必现｜**类型**：缺陷

## 问题概述 / Summary
工作台历史预览里点「导出 Markdown」，文件写到了 `.nand/terminal-agent/exports/` 下。以点开头的文件夹不会被 Obsidian 索引，所以导出的文件在文件列表、快速切换（`Ctrl+O`）、搜索里都找不到，只能去系统文件管理器里翻。`docs/agent-workbench.md` 写的是导出后可以从 Obsidian 文件列表打开。

影响 / Impact：
- 用户导出后在 Obsidian 里找不到文件；提示里只有一个路径，没有「打开」按钮

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."），默认分支 `main` |
| 版本 / Version | nand 0.0.1（manifest 版本未变）；Release / tag：没有新 release |
| 构建 / Build | `pnpm install --frozen-lockfile && pnpm run build`（pnpm 11.1.3）；产物与仓库提交的一致：是；仓库自带测试：45/45 个 `test:*` 脚本通过；终端服务用本提交源码 `cargo build --locked --release` 编译 |
| 应用 / App | Obsidian 1.13.7（Linux AppImage）；界面语言：English；插件语言：中文（第 3 次复现时为 English） |
| 系统 / OS | Debian 13，Linux 6.12；无 GPU；窗口 1280×740 |
| 测试环境 / Test env | 全新测试库 + 全新应用配置目录，只启用本插件；本机**没有安装**任何智能体 CLI（Claude Code、Codex 等都没有） |
| 测试时间 / Time | 2026-09-28 06:55–07:00 UTC+8 |

## 前置条件 / Preconditions
- 当前库里有至少一条智能体历史会话（本轮用的是测试样本：一条 Codex 会话，工作目录是库根目录）

## 复现步骤 / Steps to reproduce
1. 点击「打开NAND终端」，在右侧「当前库历史」里点一条会话
2. 在预览区点「导出 Markdown」
3. 按 `Ctrl+O` 输入 `codex`；再在左侧文件列表里找 `.nand` 文件夹

## 期望结果 / Expected behavior
- 导出的文件能在 Obsidian 里直接打开：例如导出到库里普通文件夹（可在设置里改），或者导出完成的提示里带「打开」按钮

## 实际结果 / Actual behavior
- 第 2 步：右上角提示 `.nand/terminal-agent/exports/codex-codex-alpha-1790549627218.md`（截图 1），磁盘上文件确实生成了，内容正确
- 第 3 步：快速切换搜不到，文件列表里没有 `.nand` 文件夹
- 连续 3 次导出都一样，3/3

## 截图与日志 / Screenshots & logs
![02-history-export-notice.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-02-history-export-notice.png)
（导出完成只提示一个隐藏文件夹里的路径；终端区域已遮挡）

## 疑似影响范围 / Suspected scope
- 模块 / 文件：`src/terminal-agent/` 历史导出（按代码推断）
- 引入提交：`0dc97e9`（新功能）

## 建议 / Suggestions
- 默认导出到库里的普通文件夹（例如 `NAND 导出/`），或在设置里可配置
- 导出完成的提示里加「打开」，直接在新标签页打开导出的笔记
- 同时更新 `docs/agent-workbench.md` 的说明

---
<sub>🤖 由「NAND 端到端测试」（Grok Bot）在第 10 轮 E2E 测试中发现并提交｜测试节点 `0dc97e9`｜2026-09-28 UTC+8</sub>


## Source Comments


