[English](README.md) | 简体中文

# NAND

面向 Obsidian 的个人工作台：看板、评论、编程智能体、内置浏览器、档案、图标、自动化、通知与 Git 同步。所有功能从一个三栏工作台进入，并提供覆盖 Obsidian 界面与 Markdown 的全局外观。

NAND 当前版本为 0.0.2-alpha.1，是预发布版。

界面提供简体中文与英文。新库跟随 Obsidian 的界面语言，之后可在工作台 **设置 → 常规 → 语言** 切换。

## 安装

1. 从 [GitHub Release](https://github.com/NAMEWTA/nand/releases) 下载 `main.js`、`manifest.json`、`styles.css`。
2. 放入库的 `.obsidian/plugins/nand/` 目录，在 **设置 → 第三方插件** 中启用 NAND。

需要 Obsidian 1.13.0 或更高版本。终端、编程智能体、内置浏览器和 Git 同步需要桌面版。

终端使用一个小型原生辅助程序 `nand-pty`。它不在这三个插件文件里：第一次打开终端时，NAND 会从同一版本的 Release 下载适合你平台的辅助程序，校验 SHA-256 摘要，并保存在当前库的 `.nand/helpers/<device-id>/<platform-arch>/<version>/` 中。

功能区只有一个「打开工作台」图标。左侧图标轨切换模块，第 2 栏列出当前模块的对象，第 3 栏是页面。设置在图标轨底部的齿轮里。见 [工作台](docs/workbench.md)。

## 功能

[使用指南](docs/README.md)涵盖每项功能，包括设置、外观、恢复与隐私。

| 功能 | 指南 |
|---|---|
| 工作台 | [响应式图标轨与侧栏、专注模式，用量与状态显示在 Obsidian 状态栏](docs/workbench.md) |
| 设置与外观 | [语言与模块开关](docs/settings.md)；[样式、Markdown 标题与强调色](docs/appearance.md) |
| 看板与记录 | [基于 Apex 网格的自由小组件画布：添加、拖动、缩放和尺寸档](docs/dashboard.md)；[习惯、记账、阅读、番茄钟](docs/dashboard.md#统计与账本) |
| 自动化 | [模板、定时动作、预检、运行记录与通知](docs/automation.md) |
| 编程智能体 | [终端/网页标签组、恢复、历史、快捷命令与用量](docs/agent-workbench.md) |
| 浏览器 | [个人资料、Cookie 导入、下载与材料采集](docs/browser.md) |
| 档案 | [个人、企业、任职、关系和相关资料](docs/contacts.md) |
| 笔记导航器 | [双栏文件夹和标签浏览，搜索、快捷方式、日历与周期笔记、模板、库配置档、合并笔记与标签操作](docs/navigator.md) |
| 批注 | [行级/选区批注、悬停线程和 Obsidian 侧栏](docs/comments.md) |
| 图标 | [文件和界面图标、颜色及规则](docs/icons.md) |
| Git 同步 | [用系统 Git 提交、拉取、推送整个库并处理冲突（桌面端，默认关闭）](docs/sync.md) |
| 数据与隐私 | [保存位置、备份与恢复](docs/data.md)；[日志、联网和交给智能体的材料](docs/privacy.md) |

每个模块都可以在设置中单独关闭；关闭的模块不会在启动时加载。Git 同步默认关闭。

## 数据与同步

全部 NAND 管理数据位于当前库的 `.nand/`：受管 Markdown/附件在 `.nand/content/`，配置、设备身份、浏览器会话/下载、CLI HOME/凭据/Hook 和按版本保存的 helper 均在其中。受管文档通过工作台浏览和编辑；普通笔记、宿主数据和 Git 元数据保留原位。Obsidian Sync 不包含点目录，`.nand/content/` 也不例外；请使用支持隐藏目录的文件同步工具。浏览器与 CLI 登录状态跨设备可能需要重新认证。[数据与恢复](docs/data.md)说明格式、备份和故障恢复。当前维护指南只保留中文，根 README 保持双语。

尚未发布的重构采用新的看板与批注格式，四类记录由 Markdown 改为 JSON。旧文件原位保留且不迁移；不兼容的设置和旧叶子布局回到当前默认值。新闻模块及浏览器自动化扩展已删除。升级前请备份，见[格式边界](docs/data.md#本次重构的格式边界)与[变更说明](CHANGELOG.md)。

## 开发

编程智能体和贡献者从 [AGENTS.md](AGENTS.md) 开始，它指向[开发规则](.agents/skills/dev/SKILL.md)与[界面规则](.agents/skills/ui/SKILL.md)。领域术语、架构决定与当前基线见[开发文档索引](speculo/.speculo/specdev/.config/domain-layout.md)。

使用 `package.json` 指定的 pnpm 版本：`pnpm install --frozen-lockfile`，然后 `pnpm build`、`pnpm lint`、`pnpm test:all`。构建重建 `main.js` 和 `styles.css`；只改样式时用 `pnpm build:css` 经过 Tailwind 流水线重建。终端辅助程序是 `native/pty-server` 里的 Rust 项目，用 `pnpm check:native` 测试。

各版本的变化见[变更说明](CHANGELOG.md)。

## 许可证

NAND 使用 MIT 许可证，见 [LICENSE](LICENSE)。第三方署名：

- [NOTICE](NOTICE) 列出 NAND 改编的作品并保留它们的许可证原文：apex-dashboard 与 obsidian-dashboard（看板设计）、Orca（工作台、智能体、浏览器与自动化界面）、Margin Comments（批注锚点和交互）、shadcn/ui（组件）、Geist 字体、Iconic（图标规则）和 obsidian-git（Git 同步）。笔记导航器参考 Notebook Navigator 的行为独立重写，未包含其代码，见[参考范围](docs/third-party/notebook-navigator.md)与 [Orca 对照](docs/third-party/orca-terminal-workbench.md)。
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 列出打包进插件的 npm 依赖、CSS/字体许可和终端辅助程序的 Rust 依赖。
- 图标、Emoji 与 Unicode 数据的声明见 [src/modules/icons/core/res/NOTICE.txt](src/modules/icons/core/res/NOTICE.txt)。

`LICENSE` 和 `NOTICE` 是法律文本，只有英文版，因此没有中文对应文件。
