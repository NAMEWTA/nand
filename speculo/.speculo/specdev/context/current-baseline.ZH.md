[English](current-baseline.md) | 简体中文

# 当前基线

本文陈述代码现在是什么。声明的目标不会写成实测结果：实测数据和尚未验证的项目见[验证](validation.ZH.md)。

## 身份

| | |
|---|---|
| 显示名、插件编号 | NAND，`nand` |
| 版本 | 0.0.1-alpha.1（`manifest.json`、`package.json`、`versions.json`） |
| `minAppVersion` | `1.13.0`，仅为声明 |
| `isDesktopOnly` | `false` |
| 许可证 | MIT |
| 入口 | `src/app/main.ts`，构建为已提交的 `main.js` |
| 样式 | 一份已提交的 `styles.css`，由 `src/styles.json` 列出的作者文件拼接而成 |
| 原生辅助进程 | `native/pty-server`（`nand-pty`），由 CI 构建，作为 Release 附件发布 |
| 界面语言 | 简体中文（`zh`）与英文（`en`） |

## 视图与入口

- 注册两个视图类型：`nand-workbench-view`（工作台）和 `nand-comments-view`（评论侧栏）。
- 功能区只有一个入口，用来打开工作台。命令 `open-workbench` 作用相同。
- 外壳还提供打开浏览器、自动化、通知、档案的命令，新建自动化、切换主题预置和复制笔记引用的命令。各模块在启用期间添加自己的命令。
- 设置是工作台里的页面（常规、外观、每个已启用产品一页、关于）。Obsidian 的设置页只保留打开它们的入口。

## 模块

`src/app/manifests.ts` 列出九个模块。每个模块有纯数据的清单和懒加载入口。

| 模块 | 顺序 | 平台 | 默认 | 激活时机 | 工作台中的功能 |
|---|---:|---|---|---|---|
| `browser` | 10 | 桌面、移动 | 开 | startup | `browser`（页面需要 Electron，仅桌面） |
| `home` | 20 | 桌面、移动 | 开 | startup | `dashboard`、`records` |
| `comments` | 30 | 桌面、移动 | 开 | startup | `comments`；编辑器扩展；侧栏 |
| `archives` | 40 | 桌面、移动 | 开 | startup | `contacts` |
| `agent` | 50 | 桌面 | 开 | startup | `terminal` |
| `icons` | 60 | 桌面、移动 | 开 | startup | `icons` |
| `notifications` | 70 | 桌面、移动 | 开 | startup | `notifications`（位于图标轨底部） |
| `automations` | 80 | 桌面、移动 | 开 | startup | `automations` |
| `sync` | 90 | 桌面 | 关 | layout-ready | `sync` |

`settings` 功能属于应用本身。`records` 功能（习惯、记账、番茄钟、阅读）在图标轨上是 `dashboard` 的子项。

跨模块的服务和贡献点：`agent.sessions`、`agent.workbench`、`agent.automation-runtime`、`automations.ui`、`automations.sources`、`browser.open`、`browser.agent-bridge`、`comments.panel`、`comments.index`、`home.workbench`、`notifications.inbox`、`notifications.openers`、`sync.workbench`。

## 设置与数据位置

设置是命名空间（`app`、`theme`，以及每个有设置的模块一个），保存在两个文件：`.nand/config/settings.json`（库级）和 `.nand/config/devices/<device-id>.json`（设备级）。见 [ADR-0003](../adr/0003-namespaced-settings-store.ZH.md)。

| 数据 | 位置 |
|---|---|
| 评论线程 | `.nand/editor/comments/` |
| 图标规则与偏好 | `.nand/icons/iconic.json` 及轮换备份 |
| 自动化运行记录 | `.nand/automation/<device-id>/runtime.json` |
| 自动化定义 | `NAND/自动化/`（Markdown），以及看板和档案文档 |
| 通知收件箱与回执 | `.nand/notifications/<device-id>/inbox.json` |
| Agent 历史标注与缓存 | `.nand/terminal-agent/<device-id>/`（`index.sqlite` 是可重建的缓存） |
| 浏览历史与站点权限 | `.nand/browser/<device-id>/state.json` |
| 恢复草稿、看板备份与冲突 | `.nand/recovery/` |
| 缓存 | `.nand/cache/` |
| 业务记录 | `NAND/习惯/`、`NAND/记账/`、`NAND/番茄钟/`、`NAND/阅读/`（Markdown） |
| 档案 | 配置的文件夹（默认 `档案`），其中有 `个人档案/<名称>/基本信息.md` 和 `企业档案/<名称>/基本信息.md` |
| Agent 会话导出 | `NAND Exports/` |
| Git 同步的计时与暂停状态 | `<git dir>/nand-sync.json`，不会被提交 |
| 终端辅助进程二进制 | `<插件目录>/binaries/` |

看板就是用户选定的笔记。Obsidian Sync 不同步以点开头的目录，所以 `.nand/` 需要 Git 或其他会复制隐藏目录的工具。

## 体积预算

`scripts/bundle-budget.json` 记录上限；`pnpm run check:bundle` 把构建结果与上限比较，超出即失败。

| 预算 | 上限 |
|---|---|
| 启动时执行的代码 | 120 KiB |
| `main.js` | 3.75 MiB（3,932,160 字节） |
| `styles.css` | 720 KiB（737,280 字节） |
| 激活 `home` | 450 KiB |
| 激活 `agent` | 1,126 KiB |
| 激活 `browser` | 250 KiB |
| 激活 `archives`、`automations`、`icons` | 各 220 KiB |
| 激活 `sync` | 150 KiB |
| 激活 `comments` | 120 KiB |
| 激活 `notifications` | 40 KiB |

启动集合不得包含 `lunar-typescript`、`chart.js`、`@xterm/xterm`、`@xterm/headless` 和 `simple-icons`。写下本基线时，启动集合实测为 94 KiB；`main.js` 的上限余量很小，增长需要记录理由。

## 门禁

| 命令 | 检查内容 |
|---|---|
| `pnpm run build` | 源码与测试的类型检查、样式文件检查、`main.js` 的生产构建 |
| `pnpm run lint` | ESLint，零警告 |
| `pnpm run lint:css` | stylelint，配合只减不增的文件基线（`scripts/stylelint-baseline.json`） |
| `pnpm test:architecture` | 分区导入矩阵、宿主包、仅桌面代码、桶文件和运行时环；没有基线 |
| `pnpm run check:bundle` | 启动、各模块和总体预算 |
| `pnpm test` | Vitest 单元、DOM 以及用户数据格式黄金样例（`test/golden`） |
| `pnpm test:i18n` | `zh` 与 `en` 的键一致、占位符、未知键 |
| `pnpm test:docs` | 文档清单、链接、锚点、SpecDev 状态索引 |
| `pnpm run test:all` | 全部 `test:*` 脚本 |
| `pnpm run check:notices` | `THIRD-PARTY-NOTICES.md` 与打包内容和 crate 依赖图一致 |
| `pnpm run check:native` | 对终端辅助进程执行 `cargo test --locked` |
| `node scripts/verify-pty-helper.mjs <binary>` | 通过 stdio 运行构建出的辅助进程：会话、流控、stdin 关闭后退出 |
| `node scripts/verify-release-artifacts.mjs <version>` | 版本、变更记录与发布文件一致 |
| `scripts/obsidian-acceptance/` | 在一次性的库中，通过调试端口驱动真实的 Obsidian |

## 持续集成与发布

- `.github/workflows/lint.yml` 在每次 push 和 pull request 时运行。Linux（Node 22 与 24）用冻结的锁文件安装，然后执行构建、`check:bundle`、重新构建的 `main.js` 与已提交文件一致的检查、lint、`lint:css`、`test:all`、`check:notices` 和 `check:native`。Windows（Node 24）执行构建、`main.js` 检查、lint、`lint:css` 和 `test:all`。
- `.github/workflows/terminal-build.yml` 为 linux-x64、linux-arm64、darwin-x64、darwin-arm64 和 win32-x64 测试并构建辅助进程，并在每个目标上运行 `scripts/verify-pty-helper.mjs`。
- `.github/workflows/release.yml` 在推送标签时运行。它构建辅助进程，核对标签与 `manifest.json`、`package.json`、`versions.json`、`CHANGELOG.md` 一致，重新构建并检查 `main.js` 与 `styles.css` 和已提交文件一致，然后创建 Release，附带插件文件、zip、辅助进程及其 `.sha256`、`SHA256SUMS.txt`、`LICENSE`、`NOTICE` 和 `THIRD-PARTY-NOTICES.md`。带预发布后缀的标签成为预发布版本。

## 终端辅助进程

协议版本为 3。帧由 4 字节大端长度、1 字节类型（控制 JSON、会话输入、会话输出）和正文组成，最大 16 MiB。某个会话未确认的输出超过 1 MiB 时，辅助进程暂停读取该会话，低于 256 KiB 时恢复。插件从与自身版本相同的 Release 下载 `nand-pty-<platform>-<arch>[.exe]`，校验 SHA-256 后运行。`NAND_PTY_BINARY` 让开发运行使用本地构建。见 [ADR-0008](../adr/0008-terminal-helper.ZH.md)。
