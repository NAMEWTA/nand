---
name: dev
description: >-
  Development rules for the NAND Obsidian plugin in this repository
  (plugin id nand): module system, lazy loading, settings store, i18n,
  storage under .nand/, tests, build budgets, licensing and releases. Use
  when editing src/, native/pty-server, styles, main.js, manifest.json,
  package.json scripts, esbuild, eslint, CI workflows or a GitHub release,
  or when the user mentions NAND, nand, 模块, 看板, 仪表盘, 评论, 终端, 智能体,
  浏览器, 档案, 自动化, 通知, 图标, 设置, Git 同步, 发版, or Obsidian 插件.
  Project rules override generic Obsidian plugin advice. Rendering inside the
  workbench is the ui skill.
license: MIT
metadata:
  short-description: Plugin development rules
  adapted-from: https://github.com/gapmiss/obsidian-plugin-skill (MIT, skill version 1.11.0, eslint-plugin-obsidianmd v0.4.x)
---

# 插件开发

本技能只适用于本仓库。它改编了 `metadata.adapted-from` 所列的 Obsidian 插件规则；两者冲突时以本文为准。不要新建插件脚手架、不要改插件 id、不要把仓库改成网页应用。

## 修改前先读

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
| 原生辅助程序 | `native/pty-server`（`nand-pty`），只由 CI 构建，作为 Release 附件发布 |

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
11. 只做被要求的事。修复缺陷不重新设计小组件的样式；修改评论不重排看板。
12. 当前维护文档只保留中文，根目录 README.md 与 README.ZH.md 保持双语；产品 t() 与 en/zh 不变。删除旧重复版本前保留仍成立的独有信息。原始许可、署名、测试夹具和历史归档保持原文；永久 ADR/context 只经 SpecDev A 网关更新。`.agents/skills` 只有中文。代理从 AGENTS.md 进入，不另写 CLAUDE.md。
13. 修改本技能负责的事实时，在同一次变更里更新负责它的那一份文件（`references/skill-maintenance.md`）。

## 完成之前

运行 `pnpm run build`（会重建 `main.js`）、`pnpm run lint`，以及覆盖所改内容的测试（`references/testing.md`）。结构性变更后再运行 `pnpm test:architecture` 和 `pnpm run check:bundle`；改了 CSS 运行 `pnpm run lint:css`；改了文档运行 `pnpm test:docs`。把重建后的 `main.js` 和 `styles.css` 与源码一起提交。

## 检查清单

- [ ] 只注册了两种视图类型；持久化名称没变
- [ ] 架构检查与包体预算通过
- [ ] 关闭再开启模块后没有残留
- [ ] 新文案在所属词典里有两种语言
- [ ] 用户数据格式没变，或有意修改并更新了黄金样本
- [ ] 当前维护文档已按中文单源更新；根 README 两种语言一起维护，技能文件只维护中文
- [ ] `pnpm run build`、`pnpm run lint` 和对应测试通过；`main.js` 已重建
