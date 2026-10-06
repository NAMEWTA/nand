# NAND

面向 Obsidian 的个人工作台：看板、评论、CLI Agent、内置浏览器、档案、图标和自动化共用清晰的领域服务与原生界面。

默认简体中文，可在 **设置 → NAND → 首页 → 通用设置 → 语言** 选择 English。首页同时管理功能模块开关。

## 开始使用

将匹配版本的 main.js、manifest.json、styles.css 放入库的 .obsidian/plugins/nand/，启用插件后打开 NAND 设置。功能区只有一个「打开工作台」。设置里的首页是插件设置；工作台里的首页是看板。见 [工作台](docs/workbench.md)。最低声明版本为 Obsidian 1.12.0；终端、CLI Agent 与内置浏览器需要桌面宿主。

[完整使用指南](docs/README.md)包含设置、看板、自动化、工作台、浏览器、档案、评论、图标、业务记录及恢复操作。

| 功能 | 使用入口 |
|---|---|
| 工作台 | [唯一入口、页面、分屏和终端会话](docs/workbench.md) |
| 看板 | [栏目、卡片、小组件和快捷操作](docs/dashboard.md) |
| 自动化 | [手动／定时动作、设备归属和通知](docs/automation.md) |
| Agent | [运行中的终端、原生历史、用量和上下文](docs/agent-workbench.md) |
| 浏览器 | [网页、站点权限、CLI 与材料采集](docs/browser.md) |
| 档案 | [个人、企业、任职、关系和相关资料](docs/contacts.md) |
| 编辑器 | [不改写笔记正文的评论](docs/comments.md) |
| 图标 | [文件和界面图标、颜色及规则](docs/icons.md) |

## 数据

用户资料使用 Markdown，必要配置与运行 JSON 位于当前库 .nand/。保存失败和冲突应先处理再关闭界面；不迁移或双写旧格式，也不自动清除旧文件。[数据与恢复](docs/data.md)列出目录、备份与恢复步骤。日志、联网和交给 Agent 的材料见 [隐私与数据边界](docs/privacy.md)。

## 开发

使用 package.json 指定的 pnpm，运行 pnpm install --frozen-lockfile、pnpm test:all、pnpm build、pnpm lint。构建会更新根目录 main.js。

[领域与架构入口](speculo/.speculo/specdev/.config/domain-layout.md)是维护规范入口；[当前待验收项](speculo/.speculo/specdev/changes/2026-10-01-remaining-acceptance/spec.md)说明尚未完成的实机范围。[变更说明](CHANGELOG.md)描述当前预发布 `0.0.1-alpha1`。

## 来源与许可证

NAND 使用 GPL-3.0-only，见 [LICENSE](LICENSE)。看板参考 [Leolewis2011/obsidian-dashboard](https://github.com/Leolewis2011/obsidian-dashboard)（MIT），终端参考 [ZyphrZero/Termy](https://github.com/ZyphrZero/Termy)（GPL-3.0）。

Orca 的参考提交、适配范围及 MIT 许可见 [来源说明](docs/third-party/orca-terminal-workbench.md)。图标移植自 gfxholo/iconic 1.1.10，固定提交为 268e133c6f99dcef670cbda0d25a74b8239aa099；图标、Emoji 等资源许可见 [NOTICE](src/core/icons/res/NOTICE.txt)，随构建产物保留。
