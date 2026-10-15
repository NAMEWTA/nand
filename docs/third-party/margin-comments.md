# Margin Comments 改编范围

固定参考 [jonaas-dev/obsidian-margin-comments](https://github.com/jonaas-dev/obsidian-margin-comments/tree/f727e38e7951d5ed4af24f2c3a89b2a7e32265c0) `f727e38e7951d5ed4af24f2c3a89b2a7e32265c0`（v1.0.1），MIT，Copyright (c) 2026 jonaas-dev。完整原文见 [许可证](margin-comments-LICENSE.txt) 与 [NOTICE](../../NOTICE)。

下表 NAND 路径相对 `src/modules/comments/`，上游路径相对仓库根；逐文件头保留对应来源。

| 上游 | NAND | 改编内容 |
|---|---|---|
| `src/types.ts`、`src/anchor.ts`、`src/fuzzy.ts`、`src/utils.ts` | `core/model.ts`、`anchor.ts`、`fuzzy.ts`、`hash.ts` | 行级/选区模型、上下文锚点、模糊定位与哈希；持久化为 NAND v2 旁路格式 |
| `src/editor/hover-gutter.ts`、`gutter-state.ts`、`marker-pass.ts`、`line-highlight.ts` | `ui/editor/` | 行首添加、已有批注标记、选区高亮、悬停定时与 CodeMirror 事务 |
| `src/editor/floating-comment.ts`、`bottom-sheet.ts`、`src/ui/thread-popover.ts` | `ui/popover/` | 写入框、线程浮窗与窄屏抽屉；替换为 React/Radix、所属窗口 Portal 和 NAND 服务 |
| `src/ui/thread-card.ts`、`replies.ts`、`render-comment-body.ts` | `ui/thread/` | 正文、回复、编辑、解决、删除、菜单及定位 |
| `src/ui/comment-panel.ts`、`vault-sections.ts`、`panel-filter.ts`、`panel-sort.ts` | `ui/panel/` | 当前笔记/全库、分组、筛选与排序 |
| `src/reading/reading-highlights.ts`、`reading-mode.ts`、`reading-marks.ts` | `core/reading.ts`、`ui/reading.ts` | 阅读模式标记及文本映射 |
| `src/navigation.ts`、`src/editor/comment-navigation.ts` | `ui/navigation.ts`、`commands.ts` | 跳转、上一条/下一条及编辑器定位 |
| `styles.css` | `styles/comments.css` | 编辑器与阅读标记样式；界面色彩接 NAND 主题令牌 |

NAND 保留自己的串行写入、pending 恢复日志、损坏文件隔离、模块生命周期与跨窗口管理。批注不修改笔记正文；v1 不迁移、不覆盖。上游仅作为列出的 MIT 实现来源，不意味着可直接互换数据目录。其他批注项目只用于思路参考，未作为本次复制来源；未引入 GPL/AGPL 代码。
