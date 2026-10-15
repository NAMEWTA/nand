# 编辑器批注

目标交互与格式见 [09 批注设计](../../../../docs/refor/09-设计-批注.md)，对应 D10/D13。批注存于当前库的旁路文件，从不改写笔记正文；只对 Markdown 运行，没有 PDF 入口。`src/modules/comments/` 的 `core/` 负责模型、锚点与存储，`platform/` 负责文件系统与存储交接，`ui/` 负责编辑器、右侧栏、浮窗和设置。

## 磁盘布局与模型

```text
.nand/editor/comments/index.json
.nand/editor/comments/pending.json
.nand/editor/comments/files/<sha256(路径) 的前 16 位十六进制>.json
.nand/editor/comments/set-aside/
```

- 对路径字符串计算 SHA-256，取前 16 位十六进制。索引为 `{ version: 2, files: { [path]: { hash, open, total, updatedAt } } }`，全库浏览先读索引，展开笔记后才读对应线程文件。
- 文件为 `{ version: 2, path, threads: CommentThread[] }`。线程有 `kind: 'line' | 'range'`、锚点、状态、消息与创建/更新时间；消息有 `id/author/text/createdAt/editedAt?`。`CommentStatus` 保留 `open/resolved/orphaned`，线程与消息 id 仍用 `c-…` / `m-…`。
- v1 不迁移、不读取，面板提示存在旧版数据，保留原文件；损坏文件移到 `set-aside/` 并提示，不覆盖成空文件。不能读取或写入的错误向上报告，不能缓存空结果掩盖失败。
- 设置只保存偏好（作者、gutter、颜色、悬停、模糊容差、面板位置等），不保存正文；完整设置清单见 09 §9。

## 锚点与定位

`TextAnchorV2` 保存 `kind/text/textHash/before/after/lineHint/start/end`：`text` 是选区原文或整行文字，前后文各 50 个字符，行号与偏移只是提示或缓存。

`locateAnchor` 依次执行：

1. 缓存范围仍等于 `text` 时直接采用。
2. 精确搜索；重复命中按前后文相似度打分，平分时取靠近 `lineHint` 的位置。
3. 查找 `before` 与 `after` 夹住的区域，长度限于原文的 0.5～2 倍。
4. 在行号提示前后 200 行内做有界编辑距离匹配；默认阈值 0.3，可设 0.1～0.5。行级批注只比较整行。
5. 失败标为 `orphaned`，以后不自动重新挂上；用户显式选择新位置才能重新挂接。

实时编辑由 CodeMirror `ChangeSet.mapPos` 移动位置，保存时刷新原文、上下文与行号；锚定文字全部删除即脱离。初次 `reconcile()` 完成前不应用过期偏移。选区入口仍排除 YAML 前置数据和围栏代码块；阅读高亮跳过 `pre/code/script/style` 和已处理节点。重叠范围保留覆盖它的全部线程 id，供浮窗展示。

## 存储与生命周期

- `pending.json` 保存完整下一份索引、旁路文件与过时路径；启动时先恢复已接受的写入意图，文件、索引和清理都成功后才删除日志。日志重放不是旧格式迁移。
- 变更串行进入 Promise 队列；宿主注入防抖计时器，core 不读取窗口全局。写入失败保留脏修订与草稿并报告，不能先提示已保存。
- 路径重命名或移动同步重写路径哈希、文件与索引；删除笔记按设置一并删除批注（默认）或保留。线程列表变空时清理旁路文件和索引。
- 存储关闭时同步封存新操作，写完已接受操作后才让替代存储加载。App 范围的 `Symbol.for('nand.editor.comment-store-handoff')` 协调者保留失败的关闭写入供重试，隔离不同库；激活代数防止迟到结果替换新实例。
- 模块通过 `context.editor` 注册扩展与阅读后处理器；停用释放所有编辑器订阅、计时器和浮层 React 根，侧栏叶子保留停用空状态。强制退出前尚未落日志的数据不能保证持久化。

## 界面

- 沿用 `nand-comments-view`。布局就绪后按 `comments.panelAutoPlaced` 用 `workspace.ensureSideLeaf()` 首次放入右侧栏，图标 `message-square-text`；设置可改左侧栏。不贡献工作台图标轨或工作台批注页面。
- 侧栏 React 面板切换当前笔记/全库、全部/未解决/已解决，并提供排序。通过 `COMMENTS_PANEL` 挂到 `app/workbench/comments-leaf.ts`；其他模块仅经 `api.ts` 读取 `COMMENTS_INDEX` 等服务。
- gutter 行首悬停显示添加按钮，有批注的行显示图标与数量；支持行级与选区批注。阅读模式只显示高亮、行级图标与查看入口。
- 悬停高亮或 gutter 350ms 打开，离开目标和浮窗 300ms 关闭，移入浮窗保留；点击或命令立即打开并固定。未保存编辑/回复不因鼠标离开关闭；Esc 先取消编辑，再关闭。
- 可编辑浮窗使用受控 Radix `Popover` 和虚拟矩形锚点，线程卡片在面板与浮窗共用。正文用 `MarkdownRenderer`，外层加 `nand-native`；支持查看、编辑、回复、解决/重新打开、删除、跳转与重新挂接。手机用底部 `Sheet`。
- 每个窗口一个 `CommentsOverlay` React 根，编辑器经 `services/overlay.ts` 请求开合；按 `view.dom.ownerDocument` 选 Portal，滚动更新锚点，非固定浮窗在锚点滚出时关闭。
- 表单有 Label 与快捷键说明，Ctrl/Cmd+Enter 提交，IME 组合时不提交；失败保留草稿和重试入口，关闭恢复原焦点。

## 验证

保留 `src/modules/comments/comments.test.ts`、`scripts/verify-comment-storage.ts` 与 `verify-comment-handoff.ts` 的存储和交接覆盖；模型改动同步更新版本、字段及锚点预期。测试不得指向真实库。

- 纯逻辑：行级/选区、重复原文、上下文与模糊匹配边界、失效不自动重挂、笔记正文不变。
- 存储：v2 索引和线程文件、v1 留存、损坏隔离、日志重放、部分提交、并发编辑、重命名、删除策略、关闭失败重试和跨 App 隔离。
- `dom` 项目：悬停开关计时、固定与编辑草稿、IME、键盘、焦点、右侧栏筛选及错误重试。
- 真实 Obsidian：CodeMirror/阅读集成、多窗口 Portal、滚动定位、停用再启用与侧栏放置。Node/DOM 测试不能代替宿主验收；选择方法见 [testing.md](testing.md)。
