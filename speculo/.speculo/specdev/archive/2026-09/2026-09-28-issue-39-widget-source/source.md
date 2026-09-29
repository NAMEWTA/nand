---
schema_version: 1
artifact: source
change: 2026-09-28-issue-39-widget-source
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/39
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 13e3b8f3c736d4a067e87be4e7fc507a4634db8031f7b1d6f66603172da0df86
remote_state: open
close_capability: supported
---

# Source: [自动化] 倒计时 / 纪念日提醒点「打开」或「来源」报错「Error: 来源不存在或包含重复的任务标识」

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 0 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T23:44:06Z / 2026-09-27T23:44:06Z
- Labels: [{"id": "LA_kwDOUoxLNM8AAAAC36IfOw", "name": "bug", "description": "Something isn't working", "color": "d73a4a"}, {"id": "LA_kwDOUoxLNM8AAAAC45Lz5g", "name": "severity:S3", "description": "一般：非核心功能受损，或有绕过办法", "color": "FBCA04"}, {"id": "LA_kwDOUoxLNM8AAAAC45L0Sg", "name": "priority:P2", "description": "建议近期修", "color": "8A63D2"}]
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

**严重程度 / Severity**：S3（一般）｜**建议优先级 / Priority**：P2｜**复现率 / Frequency**：4/4 必现｜**类型**：缺陷

## 问题概述 / Summary
倒计时和纪念日的提醒能按时触发，但在通知中心点这类通知的「打开」，或在自动化管理页选中它点「来源」，都只弹出「Error: 来源不存在或包含重复的任务标识」，不会跳到看板。同样操作对看板待办提醒、档案提醒都正常。

影响 / Impact：
- 用户无法从提醒跳回对应的倒计时 / 纪念日卡片，还会以为数据坏了
- 提示前面带着英文的 `Error: `

## 环境 / Environment
| 项 | 值 |
|---|---|
| 被测提交 / Commit | `0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."），默认分支 `main` |
| 版本 / Version | nand 0.0.1（manifest 版本未变）；Release / tag：没有新 release |
| 构建 / Build | `pnpm install --frozen-lockfile && pnpm run build`（pnpm 11.1.3）；产物与仓库提交的一致：是；仓库自带测试：45/45 个 `test:*` 脚本通过；终端服务用本提交源码 `cargo build --locked --release` 编译 |
| 应用 / App | Obsidian 1.13.7（Linux AppImage）；界面语言：English；插件语言：中文（第 3 次复现时为 English） |
| 系统 / OS | Debian 13，Linux 6.12；无 GPU；窗口 1280×740 |
| 测试环境 / Test env | 全新测试库 + 全新应用配置目录，只启用本插件；本机**没有安装**任何智能体 CLI（Claude Code、Codex 等都没有） |
| 测试时间 / Time | 2026-09-28 07:18–07:24 UTC+8 |

## 前置条件 / Preconditions
- 全新库，已启用 NAND，看板文件路径保持默认 `dashboard`（设置 → 看板 → 工作区显示「#1 · 当前」）
- 默认自带的倒计时「New Year Countdown」（目标 `2026-12-31T23:55`）和纪念日「纪念日」（`2025-09-28`）

## 复现步骤 / Steps to reproduce
1. 打开设置 → NAND → 看板，找到「纪念日」，点编辑，打开「每年提醒」，保存
2. 同一页找到倒计时「New Year Countdown」，点编辑，「提前提醒（天）」输入 `95`，保存
3. 等提醒触发（纪念日立即触发；倒计时在下一分钟触发），点功能区「通知中心」
4. 在「New Year Countdown」那条上点「打开」
5. 在「纪念日」那条上点「打开」
6. 点功能区「自动化」，在列表里选中「纪念日」，点「来源」

## 期望结果 / Expected behavior
- 第 4–6 步：打开看板视图，定位到对应的倒计时 / 纪念日卡片（与待办提醒的「打开」一致）

## 实际结果 / Actual behavior
- 第 3 步：两条提醒都按时出现（「纪念日：已经 1 年了」07:18:44，「倒计时提醒：New Year Countdown 还有 95 天！」07:19:44）
- 第 4、5 步：右上角提示「Error: 来源不存在或包含重复的任务标识」，通知中心不关闭，不跳转
- 第 6 步：同样的提示（截图 1）
- 共 4 次（倒计时「打开」2 次、纪念日「打开」1 次、纪念日「来源」1 次），4/4
- 对照：看板待办提醒的「打开」→ 看板视图；档案提醒的「打开」/「来源」→ 档案面板并选中记录，都正常

## 截图与日志 / Screenshots & logs
![04-widget-source-error.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-04-widget-source-error.png)
（纪念日提醒点「来源」：右上角报错）

通知记录里的来源（`.nand/notifications/<设备>.json`）：
```text
纪念日            source: {"kind":"widget","path":"dashboard","id":"widget:av-default"}
r10 自动创建的待办 source: {"kind":"dashboard","path":"dashboard.md","id":"…"}
```

## 疑似影响范围 / Suspected scope
- 模块 / 文件：`src/dashboard-view/persist/automation.ts`（小组件来源的 `path` 取的是设置里的 `dashboardFile`，即不带 `.md` 的 `dashboard`）；`src/plugin/automation-host.ts` 的 `open` 用 `app.vault.getFileByPath(source.path)` 找文件（按代码推断）
- 引入提交：`0dc97e9`（倒计时 / 纪念日提醒改由插件级自动化服务执行）
- 可能一起受影响：设置里把看板路径改成 `notes/dashboard` 等其它路径时同样会失败

## 建议 / Suggestions
- 小组件来源保存完整文件路径（补 `.md`），或在打开时按看板路径规则解析
- 提示文案去掉 `Error: ` 前缀
- 建议在 `test:automation` 里补一个「小组件来源 → 打开」的用例

---
<sub>🤖 由「NAND 端到端测试」（Grok Bot）在第 10 轮 E2E 测试中发现并提交｜测试节点 `0dc97e9`｜2026-09-28 UTC+8</sub>


## Source Comments


