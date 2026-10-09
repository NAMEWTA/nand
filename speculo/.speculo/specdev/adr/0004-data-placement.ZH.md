[English](0004-data-placement.md) | 简体中文

# ADR-0004：数据位置与安全写入文档

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

NAND 把看板、记录、档案、评论、图标规则、运行记录和设置保存在用户的库里。用户会自己编辑这些 Markdown，会在多台设备间同步库，也会备份。整篇替换文档、让已删除的行复活，或把读取失败当成空文件，都会毁掉用户数据。

## 决定

**数据放在哪里。**

- 用户内容是可见文件夹里的 Markdown：看板（用户选定的笔记）、档案（配置的文件夹，`个人档案/<名称>/基本信息.md` 与 `企业档案/<名称>/基本信息.md`）、业务记录（`NAND/习惯/`、`NAND/记账/`、`NAND/番茄钟/`、`NAND/阅读/`）、自动化定义（`NAND/自动化/`）和 Agent 会话导出（`NAND Exports/`）。
- NAND 的配置和运行时 JSON 放在库的 `.nand/` 下，按领域组织；状态属于某一台设备时再按设备编号分开：`config/`、`editor/comments/`、`icons/`、`automation/<device-id>/`、`notifications/<device-id>/`、`terminal-agent/<device-id>/`、`browser/<device-id>/`、`recovery/` 和 `cache/`。
- 插件目录只放构建出的插件文件和下载的终端辅助进程，不保存用户数据或设置。
- Git 同步把自动同步的计时和暂停标记保存在仓库的 git 目录内，因此它们不会被提交。
- Obsidian Sync 不同步以点开头的目录。用户指南会告知用户：`.nand/` 需要 Git、iCloud、Syncthing 或类似工具。

**评论是旁路文件。** 评论正文、线程和锚点保存在 `.nand/editor/comments/`：一个索引、一个待处理日志，以及每篇笔记一个文件（文件名取笔记路径的哈希）。笔记本身从不被改写。锚点是带前缀和后缀的文本引文，并缓存偏移量。定位先试偏移量，再试带上下文的引文，最后找离原位置最近的引文。都对不上时，线程被标为失效，没有用户的显式操作不会重新打开或重新附着。写入意图在文件改动前先写入日志，下次加载时重放。

**图标有自己的存储。** 图标规则和偏好保存在 `.nand/icons/iconic.json`，并有轮换备份，沿用该模块所改编的上游项目的 schema。全局设置只保存模块开关。

**写入 Markdown。** `DocumentRepository` 读取快照，只修改 NAND 拥有的部分：YAML 属性、带稳定行编号的表格行，以及 `<!-- nand:... -->` 标记之间的区段。它在核对最新文本之后，经库的原子 process 调用写入，保护编辑器中未保存的文本，并与开始编辑时观察到的基线做三方合并。未知的 YAML、注释和自由正文原样保留。读取或解析失败从不被当成空文档，区段标记无效时会抛出错误。删除记录是设置 `nand-deleted` 并保留文档。同一存储内的写入按路径串行。

**保存状态可见。** `DurableState` 暴露 `saved`、`saving`、`unsaved` 和 `conflict`。保存失败时，输入作为草稿保存在 `.nand/recovery/drafts/`；看板冲突时，副本保存在 `.nand/recovery/dashboard/conflicts/`。「副本已保存」从不表示原文件已被修改。

**格式被锁定。** 看板、档案、自动化定义、评论旁路文件、业务记录和 `iconic.json` 经生产代码写出，并与 `test/golden/` 中的快照逐字节比较。改变格式是有意的行为，并在同一次修改中更新快照。

## 影响

用户可以用普通工具读取、编辑和备份自己的数据。写入比替换文件需要更多代码，冲突时会停止保存而不是覆盖。备份必须包含隐藏目录。

## 依据

[文档仓储](../../../../src/shared/storage/document-repository.ts)、[持久状态](../../../../src/shared/storage/durable-state.ts)、[三方合并](../../../../src/shared/storage/three-way-merge.ts)、[Obsidian 文档端口](../../../../src/host/obsidian/storage/document-collection.ts)、[评论存储](../../../../src/modules/comments/core/store.ts)、[黄金样例测试](../../../../test/golden/user-formats.test.ts)。`pnpm test` 覆盖存储、评论和黄金样例测试。
