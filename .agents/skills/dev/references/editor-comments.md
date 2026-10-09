# 编辑器评论

评论是库上的旁路文件。这项功能从不写入笔记文件。没有 PDF 入口：扩展只对 Markdown 运行。代码在 `src/modules/comments/`（`core/` 是模型、锚点和存储；`platform/` 是库文件系统和存储交接；`ui/` 是编辑器扩展、浮层、侧栏、工作台页面和设置页）。

## 磁盘布局

```
.nand/editor/comments/index.json
.nand/editor/comments/pending.json
.nand/editor/comments/files/<sha256(路径) 的前 16 位十六进制>.json
```

- 对路径字符串（不是文件内容）用 `crypto.subtle` 的 SHA-256 计算哈希，取前 16 位十六进制。
- `index.json` 是 `{ version: 1, files: { [path]: { hash, open, total, updatedAt } } }`。
- `pending.json` 是可恢复的写入意图，包含完整的下一份索引、旁路文件内容和过时的文件路径。加载前先重放它；只有旁路文件、索引和清理都成功之后才移除。
- 读取、解析和形状错误向上传播，不缓存空结果。脏路径的修订号在写入失败和写入等待期间的同步编辑中保持。宿主通过 `onError` 报告后台失败。
- 每个文件文档是 `{ version: 1, path, comments: CommentThread[] }`。
- 线程列表为空时，删除该旁路文件和索引条目。
- 写入在一条 Promise 链上串行，并用宿主注入的计时器防抖（300 毫秒）（`CommentStoreOptions.timers`；core 不读取任何全局变量）。模块关闭或插件卸载时存储被关闭（封存并写完）。宿主报告拒绝；进程被强制退出时，无法保证尚未写入日志的数据被持久化。
- `comments` 设置命名空间（`src/modules/comments/settings.ts`）只保存 `highlightEnabled`、`popoverEnabled` 和可选的 `sidebarWidth`，绝不保存评论正文。

## 模型

`CommentStatus`：`open` | `resolved` | `orphaned`。

`TextQuoteAnchor`：`exact`、`prefix`、`suffix`。前缀和后缀各 24 个字符。引用文本是事实来源，偏移量只是缓存。

线程 id 形如 `c-…`，消息 id 形如 `m-…`。

## 定位引用

`src/modules/comments/core/anchor.ts` 里的 `locateAnchor`：

1. 如果 `doc.slice(start, end) === exact`，保留偏移量。
2. 否则搜索一次 `prefix + exact + suffix`。
3. 否则搜索 `exact`，取离原起点最近的命中。
4. 否则由调用方设为 `orphaned`。

不要猜测附近的段落。不要因为后来的文字碰巧匹配就自动重新打开失效线程。`reopen()` 拒绝失效线程。`reanchor()` 是用户的显式操作，绑定新的选区并设为 `open`。

`selectionIsCommentable` 拒绝起点在 YAML 前置数据内、或位于围栏代码块内的选区。阅读模式的高亮也会跳过 `pre`、`code`、`script`、`style` 和已有的 `.nand-editor-comment-hl` 节点。

## 存储规则

- 存储关闭时同步封存新操作，并在替代存储加载之前写完已接受的操作。以 App 为范围的 `Symbol.for('nand.editor.comment-store-handoff')` 协调者（`platform/store-handoff.ts`）在插件包重载后依然存在，保留失败的写完操作以便重试，并隔离不同的库。激活代数防止迟到的设置或清理替换较新的存储。编辑器激活是异步的；扩展仍然每个插件实例只注册一次。
- `applyChanges` 在该路径的 `reconcile()` 运行之前什么都不做。初始加载期间的按键不能拖动过期的偏移量。
- `reconcile` 重新定位 open 和 resolved 线程，并把未命中的标为 `orphaned`。它不改写只是发生位移的引用文本。
- `applyChanges` 用 `ChangeSet.mapPos` 映射偏移量，从新文档刷新引用文本，并把范围塌缩的线程标为失效。
- 重叠的 CodeMirror 标记会被丢弃（游标前进到已接受标记的末尾）。只有 `doc.slice` 仍等于 `exact` 时才绘制标记。
- `renamePath` 把线程移到新路径，并用新哈希重写旁路文件。
- `deletePath` 移除索引条目和旁路文件。
- 修改都经过队列。`applyChanges` 对缓存是同步的，并把路径标为脏。

## 界面

- 源码模式和实时预览：来自 `commentsCmExtension` 的 CodeMirror `ViewPlugin`。高亮遵守 `highlightEnabled`，选区浮层遵守 `popoverEnabled`。浮层关闭时添加评论命令仍然可用。
- 阅读模式：`registerMarkdownPostProcessor`。如果文件还没加载，先 `loadFile`，再重渲染该预览一次。缓存已就绪时不要再次重渲染（会死循环）。
- 侧栏：回复、解决、重新打开、删除、跳转、重新挂接。跳转先把预览切到源码，然后 `setSelection` 和 `scrollIntoView`。
- 运行时（`ui/runtime.ts`）在每次激活时创建。它通过 `context.editor` 添加 CodeMirror 扩展和阅读后处理器，所以关闭模块会把它们从每个打开的编辑器里移除；关闭侧栏只卸载面板 DOM。
- 点击高亮会聚焦该线程（`store.focus`），不会编辑笔记。
- 运行时拥有 `CommentPopoverCoordinator`，并在 dispose 时停用它。工作区激活和布局变化会独立于 CodeMirror 事务隐藏浮层。每个文档和窗口最多有一个可见的选区浮层。
- `SelectionPopover` 为同一个有效选区保留临时草稿。它对照源码面板测量实际选区，隐藏期间暂停它的输入框和按键作用域，写入前再次校验源码。模块和叶子销毁时释放草稿、观察者和监听器。重启模块会在已有的 CodeMirror 视图上重新绑定存储订阅。
- 输入框使用关联的 label 和 `aria-describedby` 提供快捷键帮助；不要再加会盖住帮助的 `aria-label` 提示。小面板会约束输入框并让操作行换行，使提交控件保持可见。

其他模块只通过 `src/modules/comments/api.ts` 看到评论：侧栏（`COMMENTS_PANEL`，由 `app/workbench/comments-leaf.ts` 挂载）和有评论的笔记索引（`COMMENTS_INDEX`，供工作台面板使用）。`src/shared/events.ts` 预留了两个没有任何代码发出的事件名；除非任务要求，不要开始发出它们。

## 测试

`src/modules/comments/comments.test.ts`（vitest，属于 `pnpm test`）用 Obsidian 桩运行测试套件；存储和交接用例在它导入的 `scripts/verify-comment-storage.ts` 和 `scripts/verify-comment-handoff.ts` 里。

存储用例覆盖读取失败、日志重放、部分提交、重命名清理和并发编辑恢复，全部通过全新的存储检查。测试套件还检查锚点、内存文件系统（笔记字符串不变）、索引哈希长度 16、回复、解决、重命名、删除、失效线程的调和，以及身份表里的视图类型常量。它把日志、旁路文件、索引和清理操作跨存储代数把关，包括关闭失败后的重试、已关闭存储拒绝修改和 App 隔离。

它用受控的 DOM 几何和工作区事件运行真实的 CodeMirror 扩展：没有 CodeMirror 事务时隐藏、滚动裁剪、草稿恢复、过期提交被拒绝以及模块重启。`test:issue-regressions` 覆盖输入框作用域与无障碍、浮层位置边界，以及把终端标题刷新路由到正确的宿主窗口。这些 Node 夹具不能代替真实 Obsidian 里的提示和窗口测试；请在 Obsidian 里实际检查一次插件停用再启用。

- 用 `process.cwd()` 解析仓库文件。
- 测试把 Node 计时器传给 `CommentStore`（`{ set: setTimeout, clear: clearTimeout }`）；界面夹具在 `globalThis` 上补上 `window`。

修改定位、序列化或边界时，向测试套件添加用例。不要让测试指向真实的库。
