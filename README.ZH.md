[English](README.md) | 简体中文

# NAND

面向 Obsidian 的个人工作台：看板、评论、编程智能体、内置浏览器、档案、图标、自动化、通知与 Git 同步。所有功能从一个三栏工作台进入，并提供覆盖 Obsidian 界面与 Markdown 的全局外观。

NAND 当前版本为 0.0.1-alpha.1，是第一个公开预发布版。

界面提供简体中文与英文。新库跟随 Obsidian 的界面语言，之后可在工作台 **设置 → 常规 → 语言** 切换。

## 安装

1. 从 [GitHub Release](https://github.com/NAMEWTA/nand/releases) 下载 `main.js`、`manifest.json`、`styles.css`。
2. 放入库的 `.obsidian/plugins/nand/` 目录，在 **设置 → 第三方插件** 中启用 NAND。

需要 Obsidian 1.13.0 或更高版本。终端、编程智能体、内置浏览器和 Git 同步需要桌面版。

终端使用一个小型原生辅助程序 `nand-pty`。它不在这三个插件文件里：第一次打开终端时，NAND 会从同一版本的 Release 下载适合你平台的辅助程序，校验 SHA-256 摘要，并保存在插件目录中。

功能区只有一个「打开工作台」图标。左侧图标轨切换模块，第 2 栏列出当前模块的对象，第 3 栏是页面。设置在图标轨底部的齿轮里。见 [工作台](docs/workbench.ZH.md)。

## 功能

[使用指南](docs/README.ZH.md)涵盖每项功能，包括设置、外观、恢复与隐私。

| 功能 | 指南 |
|---|---|
| 工作台 | [三栏布局、页面、专注模式和终端会话](docs/workbench.ZH.md) |
| 设置与外观 | [语言与模块开关](docs/settings.ZH.md)；[样式、Markdown 标题与强调色](docs/appearance.ZH.md) |
| 看板与记录 | [栏目、卡片、小组件和快捷操作](docs/dashboard.ZH.md)；[习惯、记账、阅读、番茄钟](docs/records.ZH.md) |
| 自动化 | [手动／定时动作、设备归属和通知](docs/automation.ZH.md) |
| 编程智能体 | [终端会话、原生历史、用量和上下文](docs/agent-workbench.ZH.md) |
| 浏览器 | [网页、站点权限、CLI 与材料采集](docs/browser.ZH.md) |
| 档案 | [个人、企业、任职、关系和相关资料](docs/contacts.ZH.md) |
| 评论 | [不改写笔记正文的评论](docs/comments.ZH.md) |
| 图标 | [文件和界面图标、颜色及规则](docs/icons.ZH.md) |
| Git 同步 | [用系统 Git 提交、拉取、推送整个库并处理冲突（桌面端，默认关闭）](docs/sync.ZH.md) |
| 数据与隐私 | [保存位置、备份与恢复](docs/data.ZH.md)；[日志、联网和交给智能体的材料](docs/privacy.ZH.md) |

每个模块都可以在设置中单独关闭；关闭的模块不会在启动时加载。Git 同步默认关闭。

## 数据与同步

你的内容是可见文件夹里的 Markdown。NAND 的配置与运行数据位于当前库的 `.nand/` 文件夹。`.nand/` 以点开头，Obsidian Sync 不同步以点开头的文件夹。多设备使用时，请用 Git（例如 Git 同步模块）、iCloud、Syncthing 等同步整个库。[数据与恢复](docs/data.ZH.md)列出目录、同步、备份与恢复步骤。

## 开发

编程智能体和贡献者从 [AGENTS.md](AGENTS.md) 开始，它指向[开发规则](.agents/skills/dev/SKILL.md)与[界面规则](.agents/skills/ui/SKILL.md)。领域术语、架构决定与当前基线见[开发文档索引](speculo/.speculo/specdev/.config/domain-layout.ZH.md)。

使用 `package.json` 指定的 pnpm 版本：`pnpm install --frozen-lockfile`，然后 `pnpm build`、`pnpm lint`、`pnpm test:all`。构建会更新仓库根目录的 `main.js` 和 `styles.css`。终端辅助程序是 `native/pty-server` 里的 Rust 项目，用 `pnpm check:native` 测试。

各版本的变化见[变更说明](CHANGELOG.ZH.md)。

## 许可证

NAND 使用 MIT 许可证，见 [LICENSE](LICENSE)。第三方署名：

- [NOTICE](NOTICE) 列出 NAND 改编的作品并保留它们的许可证原文：apex-dashboard 与 obsidian-dashboard（看板设计）、Orca（终端与浏览器部分）、Iconic（图标规则）和 obsidian-git（Git 同步）。Orca 的对应关系见 [docs/third-party](docs/third-party/orca-terminal-workbench.ZH.md)。
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 列出打包进插件的 npm 依赖和终端辅助程序的 Rust 依赖。
- 图标、Emoji 与 Unicode 数据的声明见 [src/modules/icons/core/res/NOTICE.txt](src/modules/icons/core/res/NOTICE.txt)。

`LICENSE` 和 `NOTICE` 是法律文本，只有英文版，因此没有中文对应文件。
