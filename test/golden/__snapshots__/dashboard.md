=== template ===
---
dashboard: true
banner:
  quote: "The only way to do great work is to love what you do."
  author: "Steve Jobs"
quickActions:
  - name: "Projects"
    icon: "file-text"
    type: file
    target: "projects/index.md"
  - name: "Journal"
    icon: "file-text"
    type: file
    target: "journal/index.md"
  - name: "Reading List"
    icon: "file-text"
    type: file
    target: "reading/index.md"
columns:
  - name: "Memo"
    color: "#f59e0b"
    type: memo
  - name: "Todo"
    color: "#6366f1"
    type: todo
  - name: "Projects"
    color: "#10b981"
    type: projects
---

## Memo

### 2025-05-13 memo
id: card-t1e8pi
type: generic
Today I started building the Obsidian dashboard plugin. The glassmorphism UI looks great.

### 2025-05-12 memo
id: card-qwjjuf
type: generic
Read an interesting article about productivity systems. Key insight: small consistent habits beat big sporadic efforts.

## Todo

### 待办清单
id: card-o5qy9
type: task
due: 2025-05-20
- [ ] Review dashboard plugin code
- [ ] Write documentation
- [ ] Test on mobile device
- [ ] Fix dark mode colors

### Weekly review
id: card-t88x5v
type: task
- [x] Check project status
- [ ] Update roadmap
- [ ] Clean up old notes

## Projects

### Obsidian Dashboard
id: card-ykvown
type: project
progress: 60%
- [[obsidian-dashboard/README.md]]
- [[obsidian-dashboard/src/main.ts]]

### Personal Website
id: card-c6s9g5
type: project
progress: 30%
- [[personal-website/index.md]]
- [[personal-website/design.md]]

### Learning Rust
id: card-nq6by8
type: project
progress: 15%
- [[rust-learning/notes.md]]

=== default ===
---
dashboard: true
banner:
  quote: "每天留下一点看得见的进步。"
  author: "NAND"
  quoteFont: "Didot,\"Bodoni MT\",Georgia,serif"
columns:
  - name: "备忘"
    color: "#f59e0b"
    type: memo
  - name: "待办"
    color: "#6366f1"
    type: todo
  - name: "项目"
    color: "#10b981"
    type: projects
  - name: "书库"
    color: "#8b5cf6"
    type: projects
---

## 备忘

### 2026-10-06 备忘
id: demo-memo-1
type: generic
欢迎使用 NAND。点击此处编辑你的第一条备忘。

### 提示：看板文件路径
id: demo-memo-path
type: generic
你可以在“设置 → 看板 → 多工作台”中修改看板文件路径。

### 提示：重命名分区
id: demo-memo-rename
type: generic
双击分区标题即可重命名分区。

## 待办

### 快速上手
id: demo-todo-1
type: task
- [ ] 尝试添加一张新卡片
- [ ] 在不同分区之间拖拽卡片
- [ ] 编辑 Banner 区的名言
- [ ] 添加一个快捷链接

### 界面操作指南
id: demo-todo-2
type: task
- [ ] 拖动小组件条中的小组件可调整顺序
- [ ] 在首页面板中打开“记录”查看统计
- [ ] 点击 Banner 区的书签按钮收起 Banner
- [ ] 在设置中开启更多小组件

## 项目

### 我的第一个项目
id: demo-project-1
type: project

## 书库

### 在读
id: demo-lib-reading
type: project

### 待读
id: demo-lib-toread
type: project

### 已读
id: demo-lib-done
type: project
