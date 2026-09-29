---
schema_version: 1
artifact: source
change: 2026-09-28-issue-38-agent-preflight
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/38
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 56c90837e534b1cab3d8444ad19537ccc5d5be12bf218bb3ca4dd2331be34579
remote_state: open
close_capability: supported
---

# Source: [自动化] 本机没装的智能体被默认选中：下拉框为空也能保存，运行时误报「请先手动启动一次该智能体」

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 0 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T23:44:05Z / 2026-09-27T23:44:05Z
- Labels: [{"id": "LA_kwDOUoxLNM8AAAAC36IfOw", "name": "bug", "description": "Something isn't working", "color": "d73a4a"}, {"id": "LA_kwDOUoxLNM8AAAAC45Lz5g", "name": "severity:S3", "description": "一般：非核心功能受损，或有绕过办法", "color": "FBCA04"}, {"id": "LA_kwDOUoxLNM8AAAAC45L0Sg", "name": "priority:P2", "description": "建议近期修", "color": "8A63D2"}]
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

**严重程度 / Severity**：S3（一般）｜**建议优先级 / Priority**：P2｜**复现率 / Frequency**：3/3 必现｜**类型**：缺陷

## 问题概述 / Summary
本机没有安装任何智能体 CLI 时，新建「运行智能体」自动化：「运行智能体」下拉框里没有可选项（显示空白 /「请选择…」），但不选也能保存，保存下来的是 `agentId: claude-code`。点「立即运行」失败，失败原因是「请先手动启动一次该智能体，确认已配置的权限模式」，而真实原因是本机没有 Claude Code。

影响 / Impact：
- 用户以为没选智能体，实际任务已按 Claude Code 保存，定时到点会失败
- 失败原因写的是权限模式，用户会去找根本不存在的权限设置，看不出是没装 CLI

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."），默认分支 `main` |
| 版本 / Version | nand 0.0.1（manifest 版本未变）；Release / tag：没有新 release |
| 构建 / Build | `pnpm install --frozen-lockfile && pnpm run build`（pnpm 11.1.3）；产物与仓库提交的一致：是；仓库自带测试：45/45 个 `test:*` 脚本通过；终端服务用本提交源码 `cargo build --locked --release` 编译 |
| 应用 / App | Obsidian 1.13.7（Linux AppImage）；界面语言：English；插件语言：中文（第 3 次复现时为 English） |
| 系统 / OS | Debian 13，Linux 6.12；无 GPU；窗口 1280×740 |
| 测试环境 / Test env | 全新测试库 + 全新应用配置目录，只启用本插件；本机**没有安装**任何智能体 CLI（Claude Code、Codex 等都没有） |
| 测试时间 / Time | 2026-09-28 07:03–07:28 UTC+8 |

## 前置条件 / Preconditions
- 全新库，已启用 NAND；设置 → 智能体保持默认（Claude Code 等默认启用）；本机没有安装 `claude` 等 CLI

## 复现步骤 / Steps to reproduce
1. 点击功能区「自动化」，点「新建自动化」
2. 「执行动作」保持「运行智能体」；「名称」输入 `r10-agent`；「提示词 / 内容」输入 `只是测试，不会运行`
3. 看「运行智能体」下拉框，不做选择，点「保存」
4. 在列表里选中 `r10-agent`，点「立即运行」

## 期望结果 / Expected behavior
- 第 3 步：下拉框没有可用智能体时，保存应当提示「请选择智能体」（编辑器已经有这条校验），或者直接说明「本机没有检测到已安装的智能体」
- 第 4 步：如果 CLI 不存在，失败原因应当是「未找到 Claude Code CLI」之类，而不是权限模式

## 实际结果 / Actual behavior
- 第 3 步：下拉框只有空白 /「请选择…」一项（截图 1），点「保存」没有任何提示，直接保存成功。数据文件 `.nand/automation/<设备>.json` 里是 `"agentId": "claude-code"`
- 第 4 步：运行记录显示「失败」，原因「请先手动启动一次该智能体，确认已配置的权限模式」（截图 2）；通知中心收到「失败: 请先手动启动一次该智能体，确认已配置的权限模式」
- 另外把「工作目录」改成一个不存在的目录、运行方式「重复执行」`0 9 * * *`，也能保存；立即运行时失败原因仍是同一句权限提示，没有提到目录不存在
- 复现 3 次：07:03（中文，手动）、07:12（中文，重复执行）、07:27（英文界面，手动），3/3 都保存为 `claude-code`

## 截图与日志 / Screenshots & logs
![03-agent-dropdown-empty-saved.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-03-agent-dropdown-empty-saved.png)
（「运行智能体」下拉框是空的，但保存成功；工作目录已遮挡）

![24-agent-run-permission-msg.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-24-agent-run-permission-msg.png)
（立即运行：失败原因写的是权限模式）

## 疑似影响范围 / Suspected scope
- 模块 / 文件：`src/automation/editor.ts`（草稿默认 agentId 取第一个「已启用」的智能体，下拉框只列出已安装的，按代码推断）；智能体运行前的检查（`src/terminal-agent/launch/automation-*`）
- 引入提交：`0dc97e9`（编辑器改动）；错误原因误报与 #36 第 1.3 条同类
- 相关 issue：#36（1.3 智能体失败原因误报）

## 建议 / Suggestions
- 草稿默认值只从下拉框实际列出的智能体里取；列表为空时保存前报「请选择智能体」
- 运行前先检查 CLI 是否存在、工作目录是否存在，分别给出明确原因

---
<sub>🤖 由「NAND 端到端测试」（Grok Bot）在第 10 轮 E2E 测试中发现并提交｜测试节点 `0dc97e9`｜2026-09-28 UTC+8</sub>


## Source Comments


