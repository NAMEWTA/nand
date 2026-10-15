# 数据与恢复

全部 NAND 自身生成、下载、持久化和管理的数据位于当前 vault 的 `.nand/`。NAND 管理的 Markdown 和附件在 `.nand/content/`，由工作台编辑、索引、搜索和打开；普通笔记、宿主自己的数据与 Git 自有元数据保留原位置。插件安装目录只保留 Obsidian 加载所需的代码、清单和样式。

## 数据保存在哪里

| 数据 | 位置 |
|---|---|
| 看板 | 你选择的看板笔记（默认 `.nand/content/dashboard.md`） |
| 常用操作条技能按钮 | 各看板 YAML 的 `skills` 字段，包含名称、图标、模板、技能名称、智能体、目标及直接发送开关 |
| 技能小组件按钮 | 全局设置的 `home.skillWidgetButtons`，按钮字段同上，各看板共用；与常用操作条列表独立 |
| 资料库和文件夹的笔记模板 | 列的 `library.templatePaths` 有序列表。列表缺失时只读投影旧 `templatePath` 为单项，不写迁移；显式 `[]` 表示空白笔记。保存配置时另将首项镜像到 `templatePath`，供旧版读取。 |
| 表格列偏好 | 每分区的 `library.tableOrder` 和 `library.tableHidden` 列表。列标识为 `file.name`、`file.modified`，以及表示笔记属性的 `property:<字段名>`。缺席字段保留偏好，重置只删除这两个列表；卡片徽章另用 `visibleProperties`。 |
| 工作流分区 | 各看板列的 `pipeline` YAML 对象保存根目录、阶段、筛选、模板、列宽和限定范围的技能。笔记保存状态、任务、`due`、`remind`；在工作流中启用提醒时，还会在 `nandAutomation` 中保存现有格式的自动化定义及所属设备 id。不要在笔记间复制该定义的 id。 |
| 已记住的技能名称与额外目录 | `.nand/config/devices/<device-id>.json` 的 `agent` 命名空间，字段为 `knownSkills`、`skillDirectories`；名称按智能体隔离 |
| 人物、企业及其资料文件 | `.nand/content/` 内的档案文件夹，默认 `.nand/content/档案/`，其中有 `个人档案/` 和 `企业档案/` |
| 独立的自动化操作 | `.nand/content/NAND/自动化/<名称>-<短 ID>/操作.md` |
| 习惯、记账、阅读、番茄钟 | `.nand/content/NAND/习惯/habits.json`、`记账/expense.json`、`阅读/reading.json`、`番茄钟/pomodoro.json`（后三项同属 `.nand/content/NAND/`） |
| 全局设置 | `.nand/config/settings.json`，按 app、theme、home、browser、comments 等命名空间保存 |
| 工作台列表 | 全局设置 `home.workspaces` 的 files、names、active |
| 已保存的看板外观 | 全局设置的 `home.customThemes` 保存“我的主题”，每项含 `id`、`name`、基础主题 `base`、颜色 `colors`，以及 `bgImage`、`bgDim`、`bgBlur`、`bgSize`、`surfaceOpacity`、`glassBlur`、`radiusScale`、`fontScale`。`colors` 可含 `accent`、`accentLight`、`bg`、`bgCard`、`bgSection`、`text`、`textMuted`、`borderCard`。`home.activeCustomThemeId` 标记上次保存或应用的主题。应用只更新 `home` 的 `stylePreset`、`customColors` 和上述装饰字段，不修改全局 `theme`，不包含看板路径、小组件配置、凭证或设备设置。 |
| 设备设置 | `.nand/config/devices/<device-id>.json` |
| 图标及其备份 | `.nand/icons/` |
| 批注与锚点（v2） | `.nand/editor/comments/` 下的 `index.json`、`pending.json`、`files/<笔记路径 SHA-256 前 16 位>.json`；损坏副本在 `set-aside/` |
| 自动化运行、通知回执 | `.nand/automation/<device-id>/`、`.nand/notifications/<device-id>/` |
| 智能体派发快照 | 同一自动化 `runtime.json`，包含最终提示词、文件引用、来源、调用 ID 和交付回执 |
| 智能体标签布局与统计 | `.nand/terminal-agent/<device-id>/workspace.json`、`stats.json` |
| 原生历史索引、标注、自动化会话 | 同目录 `index.sqlite`、`history.json`、`automation-sessions.json` |
| 快捷命令 | 本设备设置 `agent.quickCommands`；不读取旧 presets |
| 浏览历史、个人资料与站点权限 | `.nand/browser/<device-id>/state.json` 与 `profiles.json` |
| Cookie、网站缓存及下载 | `.nand/browser/<device-id>/profiles/<id>/session/`、`downloads/` |
| Cookie 导入快照 | `.nand/browser/<device-id>/tmp/<随机 ID>/`，读取完成或失败后清理 |
| 浏览器抓取、截图与标注附件 | `.nand/browser/<device-id>/artifacts/` |
| 自动化预检环境 | `.nand/automation/<device-id>/precheck-home/` |
| 恢复草稿与看板冲突副本 | `.nand/recovery/` |
| RSS 与微信读书缓存 | `.nand/cache/`；RSS 列表、正文、已读标记为 `rss/rss.json` |
| 看板定时备份 | `.nand/recovery/dashboard/backups/`，含看板 Markdown、四类记录 JSON 及来源/完整性清单 |
| 导出为笔记的智能体对话 | `.nand/content/NAND Exports/` |
| 记账导出的 CSV | `.nand/content/exports/expense-export-<日期>.csv` |
| Git 同步的计时与暂停状态 | `.nand/sync/<device-id>/<repository-hash>.json`，以及相邻恢复副本 |
| 终端组件 | `.nand/helpers/<device-id>/<platform-arch>/<version>/` |
| 智能体账号与登录环境 | `.nand/agents/<device-id>/accounts/<provider>/<stable-id>/`（空名称为 default） |

`档案`、`个人档案`、`企业档案`、`.nand/content/NAND/自动化`、`.nand/content/NAND/习惯`、`.nand/content/NAND/记账`、`.nand/content/NAND/阅读`、`.nand/content/NAND/番茄钟` 这些文件夹名在所有界面语言下都是中文，`基本信息.md`、`操作.md` 等文件名也一样。没有设置文件的库从默认值开始。

## 本次重构的格式边界

升级前先备份整个 `.nand/` 和有关笔记。本次不提供旧 NAND 数据到新结构的迁移：

- 看板使用 Apex v3.8.4 Markdown 格式；默认路径不变，不会为了“兼容”把未知旧格式当空看板覆盖。建议用新文件创建工作台，再人工整理需要的内容。
- 四类记录改存上表 JSON。旧 Markdown 记录原位保留，不自动导入。
- 批注改用 v2 旁路文件。检测到 v1 会提示只读并阻止新写入；先另存整个旧批注目录，再在活动位置创建 v2，避免混用。
- 不保证旧设置字段或工作台叶子状态兼容。无法识别的选项回到默认值；旧启动预设需重新建立为快捷命令。升级不会主动删除全部设置。
- 已删除功能的数据原位保留，不恢复其运行入口；废弃的自动化动作不执行。不要把旧运行历史当作待重放队列。

浏览器导入只读取用户选择的来源，导入快照是敏感 Cookie 数据，清理不是安全擦除。密钥读取、域名替换及同步边界见[隐私说明](privacy.md#cookie-导入)。

## 私有文件权限

桌面 POSIX 路径以 `0700` 创建目录、`0600` 创建普通文件，helper 使用 `0700`。账号及 helper 私有目录在 Windows 通过 DACL 限定为当前用户与 SYSTEM；权限失败阻止交付进程。交付前检查当前子树并拒绝链接，迁移保留恢复来源。访问控制不等于加密，也不会阻止你同步文件。普通笔记保持原权限；移动端和非文件系统适配器的具体权限行为据实说明，不冒称已实测。

## 库之外的数据

NAND 新启动的 CLI 使用库内的 HOME、提供方配置目录、XDG/Windows 数据目录和临时目录，状态 Hook 与事件文件同属账号。浏览器 Cookie、站点数据、缓存和下载进入库内的设备/profile 目录，抓取与标注附件保存在 `.nand/browser/<device-id>/artifacts/`。库外由用户自行维护的 CLI homes 不自动搬迁；NAND 不以它们作为默认账号的回退来源。

设备映射位于 `.nand/config/identity.json`，利用宿主只读身份识别当前设备。复制库需要识别或明确选择设备归属，不会自动接管另一设备的运行队列。普通笔记、宿主配置、系统 IPC 对象与 Git 自有元数据不是 NAND 业务数据。

## 多设备与同步

`.nand/` 以点开头，**Obsidian Sync 不同步以点开头的目录**。所以 `.nand/content/` 中的看板、档案、记录、操作和其他 NAND 数据也不会经 Obsidian Sync 到达另一台设备。需要在多台设备间保持一致时，请用会同步整个库（包括隐藏目录）的工具：Git、iCloud、Syncthing 等。桌面端可以直接使用 NAND 的 [Git 同步](sync.md)。

- `.nand/config/settings.json` 由库的所有设备共用；`.nand/config/devices/<device-id>.json` 和各模块的 `<device-id>` 目录只属于一台设备，同步后互不覆盖。
- 自动化只在它所属的设备上运行，见[自动化与通知](automation.md#设备归属)。
- 写入 JSON 前，NAND 会把磁盘上的外部修改与自己的修改做三方合并，并把上一份有效内容保留为 `.backup` 文件。同步工具自己产生的冲突副本仍需手动处理。

## 日常备份

1. 在编辑器和面板中完成保存，确认没有“未保存”或“存在冲突”的状态。
2. 备份你的 Markdown、相关附件和整个 `.nand/` 目录。备份工具需要包含隐藏目录。
3. 恢复前，先关闭相关模块，保留当前出问题的文件副本，再恢复确认有效的内容和设置。
4. 重新开启模块后检查内容和设备设置。不要为了让功能恢复运行而重放被中断的外部操作。

缓存和索引可以重建。实体正文、业务记录、评论和通知回执不能当作缓存清理。浏览器会话与 CLI 账号也在 `.nand/` 中，应按敏感数据备份；登录状态跨设备不保证可用，可能需要重新认证。

## 保存失败与冲突

读取失败、已损坏的文件或无法解析的受管区域会阻止写入。保存 JSON 文件时会把上一份有效快照保留为 `.backup`。主文件损坏且存在有效 `.backup` 时，NAND 加载备份并保留损坏主文件的恢复版本；没有备份时，NAND 报告错误，并且不会覆盖该文件。图标使用自己的备份轮换规则，见[图标](icons.md#数据备份与关闭模块)。磁盘错误不会被显示为保存成功。

出现错误时，先保留当前输入，再检查权限、同步冲突和文件内容。支持重试的面板提供错误详情和重试；恢复草稿位于 `.nand/recovery/drafts/`。档案冲突时，先复制草稿，再重新载入原始资料；草稿 JSON 不是可直接导入的 Markdown。

不同字段或记录的并发修改可以合并，对同一字段的修改需要你来决定。原始笔记有未保存的编辑时，请先保存编辑器；NAND 不会绕过这个保护去写入。删除后的实体文件可能带有 `nand-deleted` 标记，这是逻辑删除，不是等待恢复的正常记录。

## 看板冲突

外部编辑与看板保存发生冲突时，NAND 暂停写入原看板，并把恢复副本保存到 `.nand/recovery/dashboard/conflicts/<id>.json`。提示中显示实际的文件路径。“副本已保存”不表示修改已写入原文；继续编辑会更新同一冲突的最新修订。

看板上的状态区提供“复制当前草稿”“复制副本路径”“重试保存”和“重新载入原文”。副本保存失败时页面保持打开：先复制草稿，修复磁盘或权限后再重试。重新载入需要确认，并保留恢复副本。副本是包含原始、当前和外部文本的 JSON，不能当作看板 Markdown 去覆盖看板。强制结束进程或磁盘不可写时，不能保证尚未落盘的输入被保存。

## 格式与语言

图片裁剪位置保存在看板 Markdown 中：`banner.imagePos` 按图片路径保存 `"x,y"` 字符串，卡片的 `coverPos` 行保存封面位置。坐标是 0 到 100 的整数百分比，未设置时为 `50,50`。只读时仅对显示归一化，越界值限制在范围内，无效值按居中显示，不自动改写原文。编辑或重置某张图片只改它的位置，其他原始条目（包括未使用的路径）保留，图片文件本身不变。

语言设置只影响界面，从不改变文件路径、身份标识、笔记正文或操作参数。
