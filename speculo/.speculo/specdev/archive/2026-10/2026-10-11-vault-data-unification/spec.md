---
schema_version: 3
artifact: "spec"
change: "2026-10-11-vault-data-unification"
status: "ready"
ready_for_tickets: true
sources: ["USER-DECISION:2026-10-11 执行新版 vault/.nand 全量存储计划","https://github.com/NAMEWTA/nand/issues/151","https://github.com/NAMEWTA/nand/issues/148"]
---

# NAND vault 数据统一与 alpha.2 交付

## 1. 问题与目标

所有 NAND 自身生成、下载、持久化及管理的数据进入当前 vault/.nand，包括 Markdown、账号与浏览器。插件加载资产按 Obsidian 安装约定保留；普通笔记、宿主和 Git 自有元数据不搬迁。保留工作台和产品双语界面；当前维护文档除 README 外中文化；原始许可与旧归档保持原文。修复 #151 六项，发布 alpha.2 后验证 #148。

## 2. 解决方案与外部行为

隐藏 Markdown 由 NAND 的 Adapter 存储、索引及编辑入口管理。浏览器使用显式绝对 Session 目录、设备/profile 隔离和冷迁移。账号支持中文及标点，规范名称与内部标识分离，默认身份也在 vault。所有迁移可恢复，不猜测碰撞目录归属。Obsidian Sync 不包含 .nand，使用支持隐藏目录的文件同步；跨设备允许重新认证。2026-10-12 用户恢复时取消本轮 Windows 专属验收要求，优先完成编码；未实测平台及真实账号据实明示。

## 4. 验收合同

| ID | 场景与可观察结果 | 接缝 |
|---|---|---|
| AC-001 | 编辑基线与提交结果显式化；外部新增、修改和删除在后续保存中保持；排队编辑不会被旧回调覆盖；备份保存最近有效磁盘版本，故障后可恢复。 | JsonStore 与真实 SettingsStore 接线 |
| AC-002 | 所有 NAND 内部持久化进入当前 vault 的 .nand；禁止路径逃逸；设备映射只在库内保存，复制库不能误领其他设备的任务；迁移 localStorage 和同步业务状态。 | 路径解析、设备初始化及现有状态调用链 |
| AC-003 | NAND 管理的 Markdown 统一进入 .nand/content；浏览、编辑、搜索、附件和链接正常；不搬迁外部普通笔记；复制、校验、切换、清理可恢复。 | 内容文档集合、工作台编辑入口与迁移清单 |
| AC-004 | 所有 NAND 网页表面绑定 vault 内的显式 Session；Cookie、站点数据、缓存、下载、桥接和临时文件进入 .nand；按设备和 profile 隔离；旧库冷迁移，跨设备允许重新登录。 | Windows Obsidian 的 Session.storagePath 与本地测试站点 |
| AC-005 | 中文及标点账号映射稳定且不碰撞；非空非法账号报错；默认账号也使用 vault 目录；各 CLI、Hook 和 helper 统一 .nand；旧碰撞目录不得猜测归属；平台权限据实验证。 | Agent 启动/恢复/自动化的真实环境与私有目录 |
| AC-006 | merge/rebase 退出零仍检查冲突；回执、通知、自动同步计数一致；Release 必须依赖同一 SHA 的完整检查和 helper；失败、取消、跳过不能发布。 | 真实 Git autostash 与 Release reusable workflow |
| AC-007 | 当前项目文档除 README 外使用中文；删除旧重复文档，保留仍成立的独有信息；ADR/context 经 A 网关提升；原始许可与历史归档保持原文；产品 i18n 保留。 | 文档政策、链接校验与 A 永久知识网关 |
| AC-008 | 发布 0.0.1-alpha.2；真实下载验证全新安装及旧 helper 升级；Windows 专属门禁按 2026-10-12 用户修订取消，真实账号和未实测平台据实列未验证；满足条件后关闭 #151/#148 并归档。 | 完整 CI、真实 Release 资产与 Windows Obsidian |

## 5. 范围

路径逃逸、保存冲突、权限失败和不支持的会话目录均明确报告；不静默改用全局数据。迁移先复制校验再切换，来源在成功验证前保留。质量检查失败阻断发布；issue 和归档以实现及实际验收证据为前提。

## 9. 验证策略

各验收合同经对应 Ticket 的定向正常/失败/回归验证，再运行完整 CI 和当前可用环境的隔离 Obsidian 新安装与升级验收；发布资产另从真实 Release 下载校验。

2026-10-12 用户恢复修订：「不需要验证windows，你的主要任务是完成编码」。取消 Windows 专属门禁，优先编码和适用检查；保留 alpha.2、两项 issue 和归档的原交付范围。单并发，不派发 agent；两轴顺序自审需明确无独立 reviewer 的局限。
