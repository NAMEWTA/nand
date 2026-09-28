# NAND

NAND 是 NAMEWTA 的通用 Obsidian 工作台。看板、编辑器、图标、档案和桌面端编程智能体按领域划分为独立模块，在设置首页里分别打开或关闭。关掉的模块不会启动。

终端和编程智能体只在桌面端启动。其他领域保留移动端入口；图标模块的当前实测覆盖桌面版 Obsidian 1.12.4 与 1.13.7，移动端真机尚未验证。

插件 id 是 `nand`。界面和持久化标识按产品域统一命名。项目处于发布前开发阶段，直接使用当前命名，不提供历史命名迁移工具，也不设置迁移门禁。

## 功能领域

| 领域 | 用途 |
|---|---|
| 看板 | 卡片、小组件、日历与阅读等工作台内容 |
| 编辑器 | Markdown 评论、高亮与复制入口 |
| 终端／编程智能体 | 六种编程智能体、原生历史与用量；见 [工作台说明](docs/agent-workbench.md) |
| 图标 | 文件和界面图标、颜色及批量规则；见 [使用指南](docs/icons.md) |
| 档案 | 联系人、企业、工作经历与人际关系；见 [档案说明](docs/contacts.md) |
| 自动化 | 统一提醒、定时创建待办、Agent 定时任务与手动快捷操作；见 [自动化说明](docs/automation.md) |
| 通知 | 应用内与系统投递、持久化收件箱、未读计数 |
| 同步 | 预留入口 |

设置页在顶部切换领域，当前领域的设置分组向下排列。首页、自动化和同步入口始终保留，关闭的功能领域隐藏其页签。

## 安装

需要 Obsidian 1.12.0 或更高版本。

1. 从 [GitHub Releases](https://github.com/NAMEWTA/nand/releases) 下载发布包。
2. 把其中的 `nand` 文件夹放进库的 `.obsidian/plugins/`；若使用自定义配置目录，放入该目录的 `plugins/`。
3. 在设置的第三方插件里启用 NAND。

以前装过旧 id 的库需要重新安装这份插件。设置不会自动迁到新目录。

功能区的首页图标打开设置首页。

评论的删除操作位于卡片右下角的“更多”菜单。Agent 设置按 CLI 路径、权限模式和额外参数分行显示；看板主题与已有配置保持兼容。


## 档案面板

档案提供联系人与企业卡片、详情页及可视化编辑，记录联系方式、任职履历、直接人际关系、生活习惯和备注；企业详情汇总已收录的现任人员、曾任人员与关键人物。

1. 在 **设置 → NAND → 档案** 选择库内资料文件夹，默认是 `档案`；点击“预览并应用”确认目录。
2. 点击功能区的通讯录图标，或执行 **NAND：打开档案**，开始新增联系人和企业。
3. 日常通过面板操作，每份档案保存为独立 Markdown 文件，便于直接阅读、备份或交给 AI 处理。停用或卸载 NAND 后，已保存的文件仍保留。

卡片最多显示 5 或 6 列，随窗口宽度调整。更换资料文件夹只切换读取位置，不自动搬移文件。完整步骤见 [档案使用指南](docs/contacts.md)。

## 图标

设置首页中的“图标”默认开启，可为文件、文件夹、标签、属性、书签和界面入口设置图标与颜色，并通过规则批量应用。功能按 Iconic 1.1.10 迁入独立领域，数据保存在插件目录的 `iconic.json`，自动备份为 `iconic.json.backup1` 等文件；不写入笔记正文。

先打开笔记，再从命令面板执行 **NAND：更改当前文件的图标**。批量规则从 **设置 → NAND → 图标 → 规则书 → 管理** 打开。

操作步骤、默认设置与备份恢复见 [图标使用指南](docs/icons.md)。使用时请停用独立的 Iconic 插件；NAND 不自动导入其数据。

## 开发与变更

当前未发布变更见 [变更日志](CHANGELOG.md)。维护者从 [开发文档索引](speculo/.speculo/specdev/.config/domain-layout.md) 查阅领域术语、架构决策与历史证据。docs 只提供用户使用说明。

## 参考项目与许可证

看板参考了 [PandoraReads/apex-dashboard](https://github.com/PandoraReads/apex-dashboard)（MIT）。终端参考了 [ZyphrZero/Termy](https://github.com/ZyphrZero/Termy)（GPL-3.0）。智能体启动与用量参考了 [stablyai/orca](https://github.com/stablyai/orca)（MIT）。感谢这些项目。

图标领域移植自 [gfxholo/iconic 1.1.10](https://github.com/gfxholo/iconic/tree/268e133c6f99dcef670cbda0d25a74b8239aa099)（MIT-0）。图标检索数据与 Emoji 数据的许可证见 [NOTICE](src/core/icons/res/NOTICE.txt)，并随构建产物保留。

Pi 的可选版本检查读取 npm 包 `@mariozechner/pi-coding-agent`；与其他更新检查共用开关。
