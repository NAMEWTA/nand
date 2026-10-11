[English](README.md) | 简体中文

# NAND 使用指南

NAND 是一个 Obsidian 插件，把看板、评论、编程智能体、内置浏览器、新闻、档案、图标、自动化、通知和 Git 同步放进同一个库，统一从一个三栏工作台进入。界面提供简体中文与英文，新库跟随 Obsidian 的界面语言。

| 要完成的事 | 指南 |
|---|---|
| 安装 NAND、选择语言、开启或关闭功能 | [设置](settings.ZH.md) |
| 选择样式、标题外观和强调色 | [外观](appearance.ZH.md) |
| 了解图标栏、侧栏和页面 | [工作台](workbench.ZH.md) |
| 组织卡片、待办、小组件和快捷操作 | [看板](dashboard.ZH.md) |
| 记录习惯、记账、阅读和番茄钟 | [业务记录](records.ZH.md) |
| 手动或定时运行操作、查看通知 | [自动化与通知](automation.ZH.md) |
| 使用 CLI 智能体、历史、用量和上下文 | [智能体工作台](agent-workbench.ZH.md) |
| 浏览网页、采集材料、授权站点权限 | [内置浏览器](browser.ZH.md) |
| 收集订阅、分析事件、收藏资料与生成简报 | [新闻](news.ZH.md) |
| 用 Markdown 管理人物和企业 | [档案](contacts.ZH.md) |
| 在不改动笔记的前提下添加评论 | [编辑器与评论](comments.ZH.md) |
| 设置文件和界面图标及图标规则 | [图标](icons.ZH.md) |
| 用 Git 提交、拉取和推送整个库 | [Git 同步](sync.ZH.md) |
| 查找数据、多设备同步、备份和恢复 | [数据与恢复](data.ZH.md) |
| 了解保存位置，以及哪些内容会离开本机 | [隐私与数据边界](privacy.ZH.md) |

## 快速开始

1. 安装并启用插件（见[设置](settings.ZH.md#安装与平台)）。NAND 会打开工作台，并显示一次简短介绍。
2. 随时可以点击左侧功能区的 NAND 图标，或运行命令 `NAND: 打开工作台` 来打开工作台。
3. 用左侧一列图标切换功能。不需要的功能可在工作台 **设置 → 常规 → 功能模块** 中关闭。

命令在命令面板中带有 `NAND:` 前缀。NAND 不设置默认快捷键，可在 Obsidian 的 **设置 → 快捷键** 中自行绑定。

## 当前状态

NAND 是预发布版本。自动运行的检查（类型检查、lint、单元与 DOM 测试、针对真实 git 的 Git 同步测试、五个平台上的终端组件）和 Linux 上 Obsidian 桌面端的实机运行记录在[验证说明](../speculo/.speculo/specdev/context/validation.ZH.md)里。以下范围尚未验证：

- Obsidian 1.13.0 本身。声明的最低版本是 1.13.0，实机测试使用的是 Linux 上更新的 1.13.x 桌面版。
- 手机和平板：还没有任何移动设备运行过该插件，移动端性能、输入法和触摸行为都没有测量。
- macOS 实机、终端中文输入法，以及智能体 TUI 的完整键盘模式。Windows Obsidian 1.13.7 已有工作台、档案、本地 Git 克隆、终端组件和新闻的定向实机检查；范围和未覆盖部分见[审查证据](../speculo/.speculo/specdev/changes/2026-10-08-all-open-issues/review-progress.json)。
- 第三方主题和代码片段。
- 真实账号：CLI 智能体的登录、启动、恢复和额度，Git 经 HTTPS 凭据管理器、SSH agent 和真实托管服务的使用，以及微信读书、音乐和天气小组件对真实服务的访问。
- 长时间运行：长期存活的终端、大量并发会话，以及跨越数天和休眠的自动化。

## 许可证

NAND 使用 MIT 许可证，见 [LICENSE](../LICENSE)、[NOTICE](../NOTICE) 和 [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)。浏览器、终端和自动化调度中参考 Orca 的部分见 [Orca 来源与适配范围](third-party/orca-terminal-workbench.ZH.md)。开发者从 [AGENTS.md](../AGENTS.md) 开始阅读。
