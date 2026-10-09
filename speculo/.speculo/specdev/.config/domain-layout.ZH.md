[English](domain-layout.md) | 简体中文

# NAND 开发文档入口

本页是贡献者和编程智能体的入口。英文是默认文本，也是规范文本。这里的每份文档在同目录下都有简体中文版本，文件名在扩展名前加 `.ZH`。

## 从哪里读起

| 想了解 | 打开 |
|---|---|
| 如何修改代码：模块、懒加载、设置、文案、测试、构建、许可 | [开发规则](../../../../.agents/skills/dev/SKILL.md) |
| 如何在工作台内渲染：外壳、设计系统、主题、动效、无障碍 | [界面规则](../../../../.agents/skills/ui/SKILL.md) |
| 代码现在是什么：模块、数据位置、预算、门禁 | [当前基线](../context/current-baseline.ZH.md) |
| 已验证与未验证的内容 | [验证](../context/validation.ZH.md) |
| 各模块拥有哪些数据、如何协作 | [领域图](../context/context-map.ZH.md) |
| 架构为什么是现在这样 | 下面的 ADR 索引 |
| 用户看到什么：设置、数据、隐私、各个页面 | [用户指南](../../../../docs/README.md) |

## 领域术语

下列术语在代码、文档和界面中含义一致。只属于某个模块的术语见[领域图](../context/context-map.ZH.md)。

| 术语 | 含义 |
|---|---|
| 工作台 | 唯一的产品视图 `nand-workbench-view`，由图标轨、二级面板和页面区组成。评论侧栏 `nand-comments-view` 是仅有的另一个视图类型。 |
| 图标轨、二级面板、页面 | 工作台的三栏：模块图标、所选模块的导航、内容。 |
| 模块 | 带清单、懒加载入口和独立生命周期的功能。编号为 `home`、`agent`、`browser`、`archives`、`automations`、`notifications`、`icons`、`comments`、`sync`。 |
| 功能 | 由模块拥有的工作台目的地：`dashboard`（home）、`terminal`（agent）、`browser`、`contacts`（archives）、`automations`、`notifications`、`icons`、`comments`、`records`（home）、`sync`，以及属于应用本身的 `settings`。 |
| 清单 | 模块的纯数据描述，启动时读取。模块代码只能经它的 `load()` 到达。 |
| 服务、贡献点 | 模块之间唯一的协作方式。服务是一个模块提供的带类型接口；贡献点汇集多个模块提供的值。二者都声明在所有者的 `api.ts` 中。 |
| 租约 | 获取服务的结果。提供服务的模块停止时，它的 `revoked` 信号中止。 |
| 设置命名空间 | 一组由 schema 约束的设置，例如 `app`、`theme` 或某个模块编号。 |
| 库级、设备级 | 设置的保存范围：同一个库的所有设备共用，或只属于这台设备。 |
| 设备编号 | 这台设备的稳定编号，用来在被同步的库中区分各设备自己的状态。 |
| `.nand/` | 库中存放 NAND 配置和运行时 JSON 的目录，按领域和设备组织。 |
| 终端辅助进程 | 原生程序 `nand-pty`，持有伪终端，并通过标准输入输出与插件通信。 |
| 看板 | 由 home 模块渲染为栏目和小组件的 Markdown 笔记。 |
| 档案 | archives 模块中以文件夹加 Markdown 记录保存的人物或企业条目。 |

## 各部分所在位置

| 路径 | 内容 |
|---|---|
| `src/app/` | 插件入口、模块注册表与契约、设置运行时、命令、工作台装配 |
| `src/shell/`、`src/ui/`、`src/theme/` | 工作台界面、设计系统、全局主题 |
| `src/host/`、`src/shared/` | Obsidian 与桌面适配；纯工具、设置存储、存储辅助、i18n 运行时 |
| `src/modules/<id>/` | 每个模块一个目录：`manifest.ts`、`api.ts`、`module.ts`、`settings.ts`、`i18n.ts`、`core`、`platform`、`services`、`contrib`、`ui`、`styles` |
| `native/pty-server/` | Rust 终端辅助进程 |
| `scripts/` | 构建、预算、架构、i18n、文档、署名与验收脚本 |
| `test/` | 共享夹具，包括用户数据格式的黄金样例 |
| `docs/` | 用户指南与第三方署名说明 |
| `.agents/skills/` | 开发规则与界面规则 |
| `speculo/` | SpecDev 工具（commands、skills、workflows、`config.json`） |
| `speculo/.speculo/` | SpecDev 运行时状态；其中的 `README.md` 说明约定 |
| `speculo/.speculo/specdev/` | 本项目的知识：`adr/`、`context/`、`.config/`、`status.json`，以及为空的 `changes/`、`archive/`、`research/` |

## 架构决定

| ADR | 决定 |
|---|---|
| [0001](../adr/0001-module-contract.ZH.md) | 分区、模块契约、注册表、服务与贡献点 |
| [0002](../adr/0002-lazy-loading-and-budgets.ZH.md) | 单一打包文件、模块代码懒加载、启动与体积预算 |
| [0003](../adr/0003-namespaced-settings-store.ZH.md) | 带库级与设备级范围的命名空间设置 |
| [0004](../adr/0004-data-placement.ZH.md) | 用户内容用 Markdown，配置与运行状态进 `.nand/`，安全写入文档 |
| [0005](../adr/0005-three-column-workbench.ZH.md) | 三栏工作台及其两个视图类型 |
| [0006](../adr/0006-global-theme.ZH.md) | 全局主题 |
| [0007](../adr/0007-interface-language.ZH.md) | 界面语言与词典 |
| [0008](../adr/0008-terminal-helper.ZH.md) | 终端辅助进程与 stdio 帧协议 |
| [0009](../adr/0009-agent-sessions-and-history.ZH.md) | Agent 会话与限定在当前库的原生历史 |
| [0010](../adr/0010-browser-sessions.ZH.md) | 浏览器分区、权限与页面生命周期 |
| [0011](../adr/0011-automation-and-notifications.ZH.md) | 设备所属的自动化运行与独立的通知回执 |
| [0012](../adr/0012-git-sync.ZH.md) | 使用系统 git 的 Git 同步 |
| [0013](../adr/0013-license-and-attribution.ZH.md) | MIT 许可与第三方署名 |

## 文档规则

- 源码与可复现的检查优先于文字说明。两者不一致时，修改文档。
- 文档只写当前成立的事实，用现在时。关于平台、版本或账号的说法，只有[验证](../context/validation.ZH.md)写明已验证时才能写成已验证。
- 每份文档只有一个归属：用户指南说明操作与数据；领域图定义术语与归属；ADR 解释决定；基线与验证文档陈述事实和实测结果。彼此不复制。
- 所有文档都是双语的：英文文件是规范文本，中文文件与之对应，开头各有一行语言切换。
- `changes/` 只放进行中的工作，`status.json` 恰好列出这些目录。`pnpm test:docs` 检查链接、锚点、状态索引和必备文档。
- 第三方许可与来源署名与使用它们的代码放在一起（`NOTICE`、`THIRD-PARTY-NOTICES.md`）。
