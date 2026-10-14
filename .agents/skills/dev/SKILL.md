---
name: dev
description: >-
  修改或审查本仓库插件实现、设置、持久化、测试、依赖、构建和发布配置时使用。
  负责模块边界、懒加载、i18n、数据归属与质量验证；界面渲染同时参照 ui。
  普通产品问答、只读资料查询和未涉及工程规则的文档修订不触发开发流程。
license: MIT
metadata:
  short-description: 插件开发规则
  adapted-from: https://github.com/gapmiss/obsidian-plugin-skill (MIT, skill version 1.11.0, eslint-plugin-obsidianmd v0.4.x)
---

# 插件开发

本技能只适用于本仓库。它改编了 `metadata.adapted-from` 所列的 Obsidian 插件规则；两者冲突时以本文为准。不要新建插件脚手架、不要改插件 id、不要把仓库改成网页应用。

## 按任务读取

从下表选择与本次改动有关的参考和章节；不因文件互相链接而展开整套资料。只读审查不执行实现收尾，普通任务的授权和完成标准见根 [AGENTS.md](../../../AGENTS.md)。

| 要做的事 | 打开 |
|---|---|
| 查领域术语、架构决定或当前基线 | [开发文档索引](../../../speculo/.speculo/specdev/.config/domain-layout.md) |
| 移动文件、跨区导入、添加命令、涉及持久化名称 | [references/architecture.md](references/architecture.md) |
| 添加模块、工作台页面、服务或设置页 | [references/module-authoring.md](references/module-authoring.md) |
| 添加或修改设置、界面文案或语言规则 | [references/settings-and-i18n.md](references/settings-and-i18n.md) |
| 调用 Obsidian API，或修改 DOM、CSS、计时器 | [references/obsidian-api.md](references/obsidian-api.md) |
| 在工作台里渲染页面、面板或对话框 | [../ui/SKILL.md](../ui/SKILL.md) |
| 涉及评论、高亮或 `.nand/editor/` | [references/editor-comments.md](references/editor-comments.md) |
| 选择或编写测试，或运行真实 Obsidian 探针 | [references/testing.md](references/testing.md) |
| 构建、检查预算、升版本或发版 | [references/build-and-release.md](references/build-and-release.md) |
| 添加依赖、改编外部代码或修改终端 | [references/licensing.md](references/licensing.md) |
| 修改本技能负责的事实，或编辑技能本身 | [references/skill-maintenance.md](references/skill-maintenance.md) |

## 身份

| | |
|---|---|
| 显示名称 | `NAND` |
| 插件 id | `nand` |
| 视图类型 | `nand-workbench-view`（工作台）、`nand-comments-view`（评论侧栏） |
| 模块 | `home`、`agent`、`browser`、`news`、`archives`、`automations`、`notifications`、`icons`、`comments`、`sync` |
| `minAppVersion` | `1.13.0`（不要使用标注 `@since 1.13.1` 或更高的 API） |
| `isDesktopOnly` | `false` |
| 许可证 | MIT（`LICENSE`；署名在 `NOTICE` 与 `THIRD-PARTY-NOTICES.md`） |
| 入口 | `src/app/main.ts` → 提交到仓库的 `main.js` |
| 样式 | 一个提交到仓库的 `styles.css`，由 `src/styles.json` 列出的作者文件拼接而成 |
| 原生辅助程序 | `native/pty-server`（`nand-pty`），发行二进制由 CI 构建并作为 Release 附件发布；本地可构建和测试 |

版本号在 `manifest.json`；升版本的方法见 `references/build-and-release.md`。

## 硬性规则

1. 只注册上面的两种视图类型。产品页面是模块通过 `pages` 返回的工作台页面；「在新标签页／分屏打开」打开的是专注模式的工作台叶子，不是另一种视图类型。
2. 代码按区组织（`app`、`shell`、`ui`、`theme`、`host`、`shared`、`modules/<id>/{core,platform,services,contrib,ui}`）。导入遵守 `references/architecture.md` 里的矩阵，类型导入也算；`pnpm test:architecture` 对任何违规都会失败。模块之间只通过对方的 `api.ts` 互相访问。
3. 模块代码是懒加载的。启动代码（`app`、清单、`api.ts`、启动词典）不得静态导入模块的 `module.ts`、`core`、`platform`、`services`、`contrib` 或 `ui`，`module.ts` 也不得静态导入自己的 `ui/`。`pnpm run check:bundle` 检查启动预算和各模块预算。
4. 模块自己启动、自己停止。它创建的一切都在 `dispose()` 里，或通过 `context.lifetime`、`context.commands`、`context.editor` 释放；关闭模块后不得留下监听器、命令、编辑器扩展、body 类名或进程。一个模块失败不影响其他模块。
5. 设置是设置存储里的命名空间：用 `context.settings.bind(name, schema)` 绑定模块的模式，用 `update` 修改值。不要新增平铺的插件设置，也不要调用 `saveData`。
6. 全部 NAND 自身生成、下载、持久化和管理的数据以当前 vault/.nand 为唯一根：受管 Markdown/附件在 `.nand/content/`，配置、身份、运行状态、浏览器 Cookie/缓存/下载/桥接、CLI 凭据/HOME/临时目录/Hook 及 helper 均在其中，按领域、设备和身份隔离。插件目录仅保留宿主加载资产；普通笔记、宿主数据和 Git 元数据不搬迁。评论从不改写笔记。用户数据格式由测试锁定：看板、档案、自动化和记录由黄金样本锁定，评论旁路文件由评论测试锁定，`iconic.json` 由 Iconic 移植测试锁定。只有有意修改时才改，并同时更新样本。
7. 每条面向用户的文案都通过 `t()`，在模块自己的 `i18n.ts` 里同时提供 `en` 和 `zh`，在 `module.ts` 加载时注册。`src/shared/i18n/` 里的启动词典只放启动代码读取的键。
8. Node 和 Electron 只在 `desktop/` 文件夹里使用，且只在桌面端到达。core 和 shared 代码完全不使用宿主包。
9. 代码检查零警告通过（`pnpm run lint`）。不要为此关闭规则；修改代码，或在 `eslint.config.mts` 里记录带理由的局部例外。
10. 终端代码是为 NAND 编写的。不得复制或改写 GPL 许可的终端项目的代码；允许的参考来源见 `references/licensing.md`。
11. 范围、提交授权和文档语言遵守根 [AGENTS.md](../../../AGENTS.md)，不在本技能另设一套规则。
12. 修改本技能负责的事实时，在同一次变更里更新负责它的那一份文件（`references/skill-maintenance.md`）。

## 完成之前

按 [references/testing.md](references/testing.md) 选择验证和需要重建的产物。已通过的检查在输入、环境和风险未变时复用。把必要产物留在工作区；获得提交授权后与源码一起提交。

## 检查清单

只检查本次触及的约束；不适用项不产生额外任务。

- 视图、导入或启动边界变化：核对视图契约、架构和包体。
- 生命周期变化：核对关闭、重开及失败路径的资源释放。
- 新增或修改产品文案：所属词典保留 en/zh。
- 持久化变化：保持格式兼容，或按有意变更更新样本与相关文档。
- 构建输入变化：适用检查通过，产物与源码一致。
