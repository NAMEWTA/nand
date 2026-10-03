# 变更说明

## 0.0.1-alpha1

预发布，不是正式版。此前的 0.0.1、0.0.2、0.0.3 tag 与 Release 已删除，版本记录从本标签重新开始。已安装 0.0.3 的库不会被 Obsidian 当成升级（`0.0.1-alpha1` < `0.0.3`），需要替换 `main.js`、`manifest.json`、`styles.css` 后重新启用。

能力以 [使用指南](docs/README.md) 为准：

- 首页管理通用设置与模块开关。默认简体中文，可选 English；保存成功后立即生效，失败保留原选择。见 [首页与设置](docs/settings.md)。
- 用户资料用 Markdown。必要 JSON 按领域和设备放在 `.nand/`。含文档保真、三方合并、保存状态、故障草稿和重试；不迁移、不双写旧格式，也不自动删除旧文件。见 [数据与恢复](docs/data.md)。
- 看板组织卡片、待办和快捷操作。见 [看板](docs/dashboard.md)。
- 七种公共动作统一手动与定时执行；看板用稳定 ID 引用操作。见 [自动化与通知](docs/automation.md)。
- CLI Agent 工作台统一会话、原生历史、上下文和用量。Rust 终端协议 2 带实例鉴权。二进制只从本标签下载：`releases/download/0.0.1-alpha1/rust-terminal-servers-<平台>-<架构>`。预发布不会成为 GitHub latest。见 [Agent 工作台](docs/agent-workbench.md)。
- 内置浏览器：共享分区、站点权限、导航期限、取消、崩溃恢复、CLI 与材料采集。见 [内置浏览器](docs/browser.md)。
- 个人与企业档案按实体目录保存。见 [档案](docs/contacts.md)。
- 评论不改写笔记正文。见 [编辑器与评论](docs/comments.md)。
- 文件图标与批量规则。见 [图标](docs/icons.md)。
- 习惯、记账、阅读、番茄钟写在 `NAND/` 下各领域目录。见 [业务记录](docs/records.md)。

最低 Obsidian 1.12.0。桌面才有终端、CLI Agent 和内置浏览器。

本标签不包含尚未关闭的 issue 修复。2026-10-01 基线只证明当时的检查，不能当作本标签的产物标识。
