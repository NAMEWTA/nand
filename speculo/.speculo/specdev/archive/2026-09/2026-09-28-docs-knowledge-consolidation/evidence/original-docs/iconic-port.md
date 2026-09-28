# Issue #14：Iconic 迁入图标领域

本文记录迁移实现、必要适配和已执行验证。操作步骤、默认配置与恢复方法见 [图标使用指南](icons.md)。

来源：[gfxholo/iconic 1.1.10](https://github.com/gfxholo/iconic/tree/268e133c6f99dcef670cbda0d25a74b8239aa099)，固定提交 `268e133c6f99dcef670cbda0d25a74b8239aa099`。需求：[NAND #14](https://github.com/NAMEWTA/nand/issues/14)。没有引入第二个 Obsidian Plugin 实例，也没有合并看板原有的图标选择器。

## 结构和范围

- `src/platform/obsidian/icons/host/controller.ts`：领域生命周期及上游条目查询、修改逻辑；壳层通过 `modules.iconic` 启停，缺省开启。
- `managers/`：应用、标签页、文件/文件夹、书签、标签、属性、编辑器、功能区、建议、建议对话框、菜单和规则管理。
- `dialogs/`、`components/`：原版图标与 Emoji 搜索、颜色、规则编辑与检查、使用情况检查组件。
- `settings/model.ts`、`settings/sections.ts`：原版默认值、字段与六个设置分组。旧版及 1.13 声明式入口均保留 22 个配置项、规则书和使用情况入口。
- `persistence/store.ts`：独立文件读写、延迟保存、备份、恢复及外部重载。
- `res/`、`resources.ts`、`utils/`：上游资源及工具；私有 Obsidian API 类型集中在领域内部。
- `shared/i18n/iconic.ts`：以固定上游中英文各 339 条文案为基础，应用经过审阅的 NAND 术语修订，使用 NAND 当前语言，保留 `{#}` 占位符。

文件名使用 kebab-case，源文件使用相对导入。图标领域不依赖看板、评论、终端、档案或同步领域。14 个命令保留上游局部 ID，由 Obsidian 加上 `nand:` 前缀。

## 持久化

主文件为 `<configDir>/plugins/<manifest.id>/iconic.json`；备份为同目录 `iconic.json.backup1` 至 `iconic.json.backupN`。使用库的实际配置目录及 manifest ID，不硬编码 `.obsidian/plugins/nand`。NAND `data.json` 仅增加 `modules.iconic` 开关，不保存图标、规则、对话框状态或图标偏好，也不改写笔记正文。

保留上游字段与默认值、300ms 延迟合并保存、3 小时备份间隔、0–9 份备份、主文件缺失/损坏/为空对象且存在第一份备份时尝试恢复及恢复通知。启停时等待在途存储完成。通过 `raw` 事件及窗口重新聚焦/文档可见时检查外部修改，比较文件内容以忽略自身写入。

不自动读取独立 Iconic 插件的数据。使用 NAND 图标领域时，应停用独立 Iconic，避免双方同时修改同一批原生界面。

## 必要适配

1. 用可启停 controller 代替独立插件入口。编辑器扩展、阅读处理器和命令每个插件生命周期注册一次，关闭领域后停止实际工作。
2. 每次激活有独立的 Component。关闭时清除事件、MutationObserver、定时器、弹窗及功能区按钮，并恢复菜单和建议代理；后来由其他插件接管的方法不会被覆盖。延迟 layout-ready 回调带代次检查。
3. 单个 NAND 设置页接入六个图标分组，导航置于内容上方。1.13 声明式入口补齐上游遗漏的 `showAllFolderIcons`；`maxSearchResults` 改为显式读写图标 store，避免绑定 NAND 的 `plugin.settings`。分组标题加图标前缀以避免设置键冲突。
4. CSS 保留上游声明和类名，选择器加 `body.nand-iconic-enabled` 范围；主窗口及弹出窗口随领域状态应用/移除，恢复原有 `data-theme`。
5. 私有 API、跨窗口 HTMLElement 判断和异步生命周期做本地类型适配；不改规则判定与搜索、配色算法。
6. 最低 Obsidian 版本调整为 1.12.0，1.13 API 使用版本门控。保留旧版设置路径。

保留上游行为差异，包括旧版/声明式搜索数量滑块范围分别为 50–500 / 50–300、结果组件自身限制为 10–300，以及图标选择器 ArrowUp 原代码只读取 `previousColor` 而没有调用的行为。本次没有顺手修正这些算法/交互。外部重载采用上游刷新管理器流程，未额外重写规则缓存刷新策略；这不保证外部编辑规则后立即重新计算所有命中结果。需要立即应用外部规则改动时，可重新启用图标模块。

## 验证记录（2026-09-27）

自动检查：

- `pnpm run build`：TypeScript 与生产构建；生成仓库根 `main.js`。
- `pnpm run lint`：没有错误；图标新增领域无警告，仓库已有警告保留。
- `pnpm run test:iconic-port`：8 项测试，包括固定上游的 137 条规则输出、默认值、14 个命令 ID、中英文全量文案、三个资源 SHA-256、独立持久化、备份和恢复、自写过滤/外部重载、代理恢复、延迟启动取消和 10 次生命周期切换。
- `pnpm run test:settings-nav`：模块导航和设置键唯一性，包含图标开启时的设置定义。
- `pnpm run test:editor-comments`、`test:issue-regressions`、`test:path-picker`：现有评论、设置持久化与路径组件回归。

桌面实测使用独立配置和临时库，不操作日常使用的库：

| 场景 | 结果 |
|---|---|
| Obsidian 1.13.7 声明式设置 | 六组设置、图标页切换、所有配置行归属图标领域，无设置键重复报错 |
| 1.13.7 标签页图标样式 | 开启时 display 为 flex，关闭时为 none；body 标记上的选择器保持同元素匹配 |
| 1.13.7 搜索数量滑块 | 调到 170 后写入 iconic.json，NAND 主设置对象不变 |
| 1.13.7 图标选择器 | 在设置弹出窗口中搜索并选择 Folder，保存后为 `lucide-folder` |
| 1.13.7 规则书与快速切换器 | 文件扩展名规则应用到 Beta.md，快速切换器搜索结果显示图标 |
| 1.13.7 外部修改 | 直接修改 iconic.json 后约 900ms 内读到 Emoji 与颜色变更 |
| 1.13.7 连续启停 10 次 | 该临时库中的 NAND 命令总数 26、功能区按钮 11 保持不变（非插件固定总数）；vault 事件监听数逐项不变；每次关闭都移除样式标记；没有控制台错误 |
| Obsidian 1.12.4 旧版设置 | 六组设置正常，包含文件夹图标选项；选择 Star 后持久化正确；连续启停 3 次没有控制台错误 |

截图：[1.13 设置](iconic/settings-1.13.7.png)、[1.12 设置](iconic/settings-1.12.4.png)、[弹出窗口图标选择器](iconic/picker-popout.png)、[规则书](iconic/rules.png)。

未实测：精确的 1.12.0 客户端、Android/iOS 真机、第三方主题与第三方快速切换插件组合。桌面窗口测试不等同于移动端验证。

## 资源与发布

上游 MIT-0、Lucide ISC、Unicode License v3 及来源保存在 `src/core/icons/res/NOTICE.txt`。esbuild 将完整通知放入 `main.js` banner，既有仅包含 `main.js`、`manifest.json`、`styles.css` 的发布包也会携带许可证。本次没有改发布流程，也没有创建发布版本。

2026-09-27：修正内联标题的 body 状态选择器；命令 ID 使用 `toggle-minimal-folder-icons`。中文省略号、极简、快速切换器等调整在测试中使用显式覆盖表，固定上游 oracle 不改写。偶发加载失败 #33 未稳定复现，不将这些改动宣称为其根因修复。
