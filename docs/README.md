# NAND 使用指南

NAND 是一个 Obsidian 插件，把看板、批注、编程智能体、内置浏览器、档案、图标、自动化、通知和 Git 同步放进同一个库，统一从一个三栏工作台进入。界面提供简体中文与英文，新库跟随 Obsidian 的界面语言。

| 要完成的事 | 指南 |
|---|---|
| 安装 NAND、选择语言、开启或关闭功能 | [设置](settings.md) |
| 选择样式、标题外观和强调色 | [外观](appearance.md) |
| 了解图标栏、侧栏和页面 | [工作台](workbench.md) |
| 在自由画布上添加、拖动和缩放小组件 | [看板](dashboard.md) |
| 记录习惯、记账、阅读和番茄钟 | [看板统计](dashboard.md#统计与账本) |
| 手动或定时运行操作、查看通知 | [自动化与通知](automation.md) |
| 使用终端/网页标签组、恢复、历史、快捷命令与用量 | [智能体工作台](agent-workbench.md) |
| 浏览网页、管理个人资料、导入 Cookie 和采集材料 | [内置浏览器](browser.md) |
| 用 Markdown 管理人物和企业 | [档案](contacts.md) |
| 在左侧栏按文件夹和标签浏览笔记、预览、键盘与拖放整理 | [笔记导航器](navigator.md) |
| 添加行级/选区批注并在侧栏或悬停浮窗中处理 | [批注](comments.md) |
| 设置文件和界面图标及图标规则 | [图标](icons.md) |
| 用 Git 提交、拉取和推送整个库 | [Git 同步](sync.md) |
| 查找数据、多设备同步、备份和恢复 | [数据与恢复](data.md) |
| 了解保存位置，以及哪些内容会离开本机 | [隐私与数据边界](privacy.md) |

## 快速开始

1. 安装并启用插件（见[设置](settings.md#安装与平台)）。NAND 会打开工作台，并显示一次简短介绍。
2. 随时可以点击左侧功能区的 NAND 图标，或运行命令 `NAND: 打开工作台` 来打开工作台。
3. 用左侧一列图标切换功能。不需要的功能可在工作台 **设置 → 常规 → 功能模块** 中关闭。

命令在命令面板中带有 `NAND:` 前缀。NAND 不设置默认快捷键，可在 Obsidian 的 **设置 → 快捷键** 中自行绑定。

升级前先阅读[格式边界](data.md#本次重构的格式边界)。本次重构不迁移旧看板、记录、批注、启动预设和旧工作台叶子状态；旧文件保留。

## 当前状态

NAND 是预发布版本。既有平台验证范围见[验证说明](../speculo/.speculo/specdev/context/validation.md)。本轮重构运行了类型、lint、单元与 DOM、真实 git、样式和界面生命周期检查，并在 Linux Obsidian 1.13.7 的默认主题与 Minimal 9.0.2 下验证了主要桌面流程。以下范围尚未验证：

- Obsidian 1.13.0 本身。声明的最低版本是 1.13.0，实机测试使用的是 Linux 上更新的 1.13.x 桌面版。
- 手机和平板：还没有任何移动设备运行过该插件，移动端性能、输入法和触摸行为都没有测量。
- macOS 实机、终端中文输入法，以及智能体 TUI 的完整键盘模式。Windows Obsidian 1.13.7 已有工作台、档案、本地 Git 克隆、终端组件的定向实机检查；范围和未覆盖部分见[审查证据](../speculo/.speculo/specdev/archive/2026-10/2026-10-08-all-open-issues/review-progress.json)。
- 任意第三方主题和用户代码片段的完整组合；本轮 Linux 桌面检查覆盖默认主题与 Minimal 9.0.2，不能推及其他主题。
- 真实账号：CLI 智能体的登录、启动、恢复和额度，Git 经 HTTPS 凭据管理器、SSH agent 和真实托管服务的使用，以及微信读书、音乐和天气小组件对真实服务的访问。
- 长时间运行：长期存活的终端、大量并发会话，以及跨越数天和休眠的自动化。

## 许可证

NAND 使用 MIT 许可证，见 [LICENSE](../LICENSE)、[NOTICE](../NOTICE) 和 [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)。改编范围见 [Orca](third-party/orca-terminal-workbench.md)、[Apex 看板](third-party/apex-dashboard.md)和 [Margin Comments](third-party/margin-comments.md)。开发者从 [AGENTS.md](../AGENTS.md) 开始阅读。
