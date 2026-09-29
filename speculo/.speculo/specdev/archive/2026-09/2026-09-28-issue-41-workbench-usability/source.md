---
schema_version: 1
artifact: source
change: 2026-09-28-issue-41-workbench-usability
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/41
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 2368124526c969989cd78bf9273f6b6946f5a7a4382d554aedd225bd1ac8f14f
remote_state: open
close_capability: supported
---

# Source: [工作台][优化] 历史面板与会话列表的界面和中文化小问题 → 筛选框不压扁、中文日期、会话可区分等

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 0 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T23:44:08Z / 2026-09-27T23:44:08Z
- Labels: [{"id": "LA_kwDOUoxLNM8AAAAC36Ifmw", "name": "enhancement", "description": "New feature or request", "color": "a2eeef"}, {"id": "LA_kwDOUoxLNM8AAAAC45L0cg", "name": "priority:P3", "description": "可排期", "color": "D4C5F9"}]
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

**类型**：体验优化 / 文案 / 布局｜**建议优先级 / Priority**：P3｜**影响面**：使用新工作台（终端 + 当前库历史）的用户，中文界面用户

## 现状 / Current behavior
新的六智能体工作台（终端左侧会话列表 + 右侧「当前库历史」）功能都能用，但有一些界面和中文化的小问题：
1. 点击「打开NAND终端」，右侧历史有 100 条以上时看「未归档历史」下拉框（截图 1）
2. 把窗口宽度缩到约 800 px，看底部用量栏（截图 2）
3. 其它条目见下表

## 问题 / Problem
单条都不影响功能，但合在一起让新工作台显得没完成：控件被压扁、日期格式和界面语言不一致、多个会话分不清。

## 建议 / Proposal
见下表「建议」一列。

## 验收标准 / Acceptance criteria
- [ ] 历史很多时，筛选下拉框保持正常高度
- [ ] 中文界面的日期、时间按中文格式显示（与通知中心的 `2026/9/28 07:09:44` 一致）
- [ ] 同时打开多个会话时，列表里能区分每个会话
- [ ] 窄窗口下底部用量栏文字完整、不被状态栏盖住

## 环境 / Environment
- 被测提交：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8）；版本 0.0.1；终端服务用本提交源码编译
- 应用：Obsidian 1.13.7（Linux），界面语言 English，插件语言 中文
- 测试环境：全新测试库 + 全新配置目录，只启用本插件；历史为测试样本（6 条不同智能体会话 + 105 条批量 Codex 会话）
- 测试时间：2026-09-28 06:50–07:02 UTC+8

## 截图 / Screenshots
![05-history-filter-squashed.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-05-history-filter-squashed.png)
（「未归档历史」下拉框被压扁；终端区域已遮挡）

![06-workbench-narrow.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-06-workbench-narrow.png)
（窄窗口：底部用量按钮文字被裁掉，右下角被状态栏「用量」盖住；终端区域已遮挡）

## 合集条目（仅合集 issue 使用）
| # | 位置 | 现在 | 建议 | 截图 |
|---|---|---|---|---|
| 1 | 当前库历史 → 筛选下拉框 | 历史较多时「未归档历史」下拉框被压成约 17 px 高，文字被切掉 | 下拉框不参与列表的伸缩（固定高度） | 1 |
| 2 | 历史条目日期、用量窗口「查询时间」 | 英文格式 `9/28/2026`、`9/28/2026, 7:35:09 AM` | 跟随插件语言，中文用 `2026/9/28 07:35` | |
| 3 | 历史翻页 | 标签「1 / 111」，看起来像「第 1 页，共 111 页」，实际是「从第 1 条起，共 111 条」 | 改成「第 1–100 条，共 111 条」或「第 1/2 页」 | |
| 4 | 历史搜索无结果 | 显示「当前库暂无会话」 | 显示「没有匹配的会话」 | |
| 5 | 左侧「打开的会话」 | 开两个普通终端，两条都叫「Terminal · 状态未知」，分不清 | 显示序号 / 智能体名 / 工作目录 / 启动时间 | |
| 6 | 预览区「收藏」「归档」按钮 | 已收藏 / 已归档后按钮样式不变，看不出状态 | 显示为「取消收藏」「取消归档」或高亮 | |
| 7 | 窄窗口底部用量栏 | 文字被裁切，右端被状态栏「用量」盖住 | 允许换行或留出状态栏高度 | 2 |
| 8 | 终端标签页标题 | 中文界面下标题是英文「Terminal」 | 跟随插件语言 | |
| 9 | 命名 | 看板视图的标签页标题叫「工作台」，而 `docs/agent-workbench.md` 把新的终端 + 历史界面也叫「工作台」 | 两者用不同的名字（例如看板叫「看板」或「首页」） | |

---
<sub>🤖 由「NAND 端到端测试」（Grok Bot）在第 10 轮 E2E 测试中提出｜测试节点 `0dc97e9`｜2026-09-28 UTC+8</sub>


## Source Comments


