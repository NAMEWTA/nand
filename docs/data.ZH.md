[English](data.md) | 简体中文

# 数据与恢复

你的内容保存为可见文件夹里的 Markdown。NAND 自己的配置和运行数据集中在当前库的 `.nand/` 目录。除下面列出的终端组件和独立的智能体登录之外，插件安装目录中不保存任何业务资料。

## 数据保存在哪里

| 数据 | 位置 |
|---|---|
| 看板 | 你选择的看板笔记（第一份是库根目录下的 `dashboard.md`） |
| 看板技能按钮 | 各看板 YAML 的 `skills` 字段，包含模板、智能体、目标及每个按钮的预览选择 |
| 资料库和文件夹的笔记模板 | 列的 `library.templatePaths` 有序列表。列表缺失时只读投影旧 `templatePath` 为单项，不写迁移；显式 `[]` 表示空白笔记。保存配置时另将首项镜像到 `templatePath`，供旧版读取。 |
| 表格列偏好 | 每分区的 `library.tableOrder` 和 `library.tableHidden` 列表。列标识为 `file.name`、`file.modified`，以及表示笔记属性的 `property:<字段名>`。缺席字段保留偏好，重置只删除这两个列表；卡片徽章另用 `visibleProperties`。 |
| 工作流分区 | 各看板列的 `pipeline` YAML 对象保存根目录、阶段、筛选、模板、列宽和限定范围的技能。笔记保存状态、任务、`due`、`remind`；在工作流中启用提醒时，还会在 `nandAutomation` 中保存现有格式的自动化定义及所属设备 id。不要在笔记间复制该定义的 id。 |
| 已记住的技能名称与额外目录 | `.nand/config/devices/<device-id>.json` 的 `agent` 命名空间，字段为 `knownSkills`、`skillDirectories`；名称按智能体隔离 |
| 人物、企业及其资料文件 | 你选择的档案文件夹，默认是 `档案/`，其中有 `个人档案/` 和 `企业档案/` |
| 独立的自动化操作 | `NAND/自动化/<名称>-<短 ID>/操作.md` |
| 习惯、记账、阅读、番茄钟 | `NAND/` 下各领域目录（`NAND/习惯`、`NAND/记账`、`NAND/阅读`、`NAND/番茄钟`） |
| 全局设置 | `.nand/config/settings.json` |
| 已保存的外观 | 全局设置中的 `home.appearancePresets` 保存 `{id,name,theme,home}` 快照，`activeAppearancePresetId` 标记上次保存或应用的组合。主题字段为 `preset`、`headings`、`emphasis`、`accentLight`、`accentDark`、`lineHeight`；首页字段为 `bgImage`、`bgDim`、`bgBlur`、`bgSize`、可选 `bgFocal`、`surfaceOpacity`、`glassBlur`、`radiusScale`、`fontScale`。不包含看板路径、小组件配置、凭证或设备设置。应用时通过同一设置写入批次更新既有 `theme` 和 `home` 命名空间。 |
| 设备设置 | `.nand/config/devices/<device-id>.json` |
| 图标及其备份 | `.nand/icons/` |
| 评论与锚点 | `.nand/editor/comments/` |
| 自动化运行、通知回执 | `.nand/automation/<device-id>/`、`.nand/notifications/<device-id>/` |
| 智能体派发快照 | 同一自动化 `runtime.json`，包含最终提示词、文件引用、来源、调用 ID 和交付回执 |
| 终端索引、历史标注、自动化会话 | `.nand/terminal-agent/<device-id>/` |
| 浏览历史、账号元数据与站点权限 | `.nand/browser/<device-id>/state.json` 与 `profiles.json` |
| 新闻缓存、分析、阅读状态和 CLI 回执 | `.nand/news/<device-id>/`；保留与恢复规则见[新闻](news.ZH.md) |
| 新闻分析策略 | 库级设置 `news.prefilter` 保存屏蔽词、最少字符数和允许的语言；`news.vocabulary` 保存分类、主题和实体词表；`news.templates` 保存四类可编辑模板。新分析回执在实际提示词哈希与文本之外保存词表快照，恢复时不会用后来的设置重新解释已保存回复。 |
| 新闻本地编排参数 | 库级设置 `news.understandFloor`、`news.heatRules`、`news.editionRules` 和 `news.groupingRules` 保存数值策略。热度观测携带实际规则版本；新分析计划和已接收分析保存 `groupingConfidence`，修改设置只影响后续批次，不重新解释已保存的成员关系。 |
| 新闻小组件配置 | 库级设置的 `news.widgets`：`{id,mode,name,count,showSummary,staleMinutes,viewId?}`，模式为 `featured`、`hot`、`view`；`viewId` 引用 `news.views`。看板 Markdown 只保存成员的 provider/kind/instance ID 与布局，移除成员保留配置。 |
| 新闻收藏、简报与日报 | 默认目录为 `NAND/新闻/收藏/`、`NAND/新闻/简报/`、`NAND/新闻/日报/`，独立于缓存保留。库级设置 `news.favoriteFolder` 和 `news.editionFolder` 修改新笔记的目标目录；已有带身份属性的笔记在库内可见目录间移动后仍保留身份。`news.retentionDays` 控制原始资料和分析的保留期，CLI 回执历史仍为 30 天。 |
| 恢复草稿与看板冲突副本 | `.nand/recovery/` |
| 缓存（微信读书进度） | `.nand/cache/` |
| 导出为笔记的智能体对话 | `NAND Exports/` |
| 记账导出的 CSV | 库根目录下的 `expense-export-<日期>.csv` |
| Git 同步的计时与暂停状态 | 仓库内的 `.git/nand-sync.json`，从不提交 |
| 终端组件 | 插件目录下的 `binaries/` |
| 独立的智能体登录（可选） | 插件目录下的 `accounts/` |

`档案`、`个人档案`、`企业档案`、`NAND/自动化`、`NAND/习惯`、`NAND/记账`、`NAND/阅读`、`NAND/番茄钟` 这些文件夹名在所有界面语言下都是中文，`基本信息.md`、`操作.md` 等文件名也一样。没有设置文件的库从默认值开始。

## 私有文件权限

在桌面 macOS 和 Linux 上，NAND 以 `0700` 创建 `.nand/` 目录，以 `0600` 创建文件，包括恢复副本与原生历史数据库。启动时对既有托管路径做一次有界权限修复；权限失败会记录，不删除数据。私有路径中的软链接会被拒绝。普通笔记保持原权限，Windows、移动端和非文件系统适配器保留原有行为。Git 不保留这些权限位，因此克隆库首次加载时会重新应用。权限限制本机访问，不会加密文件，也不会阻止你同步它们。

## 库之外的数据

- CLI 智能体的原生日志、历史和登录属于各自的 CLI。NAND 只读取历史，不会把它复制进库。NAND 会在 CLI 自己的配置文件里添加小型状态 hook，见[智能体工作台](agent-workbench.ZH.md#状态-hook)。
- 浏览器的 Cookie 保存在本机 Obsidian 的 Electron 会话中。
- 浏览器的连接文件，以及交给智能体的截图和说明，位于 Obsidian 应用数据目录下的 `nand-browser/<vault-id>/`，不在库内，也不会进入库的备份。需要保留时请单独备份。
- 设备标识保存在 Obsidian 的本机存储中。复制或同步库不会让两台电脑变成同一台设备，复制库也不能代替设备归属或 CLI 登录。连接令牌只在 NAND 运行期间存在。

## 多设备与同步

`.nand/` 以点开头，**Obsidian Sync 不同步以点开头的目录**。所以 NAND 的设置、评论、图标规则、自动化运行记录和通知回执不会经 Obsidian Sync 到达另一台设备，而看板、档案、业务记录和独立操作等 Markdown 内容会照常同步。需要在多台设备间保持一致时，请用会同步整个库（包括隐藏目录）的工具：Git、iCloud、Syncthing 等。桌面端可以直接使用 NAND 的 [Git 同步](sync.ZH.md)。

- `.nand/config/settings.json` 由库的所有设备共用；`.nand/config/devices/<device-id>.json` 和各模块的 `<device-id>` 目录只属于一台设备，同步后互不覆盖。
- 自动化只在它所属的设备上运行，见[自动化与通知](automation.ZH.md#设备归属)。
- 写入 JSON 前，NAND 会把磁盘上的外部修改与自己的修改做三方合并，并把上一份有效内容保留为 `.backup` 文件。同步工具自己产生的冲突副本仍需手动处理。

## 日常备份

1. 在编辑器和面板中完成保存，确认没有“未保存”或“存在冲突”的状态。
2. 备份你的 Markdown、相关附件和整个 `.nand/` 目录。备份工具需要包含隐藏目录。
3. 恢复前，先关闭相关模块，保留当前出问题的文件副本，再恢复确认有效的内容和设置。
4. 重新开启模块后检查内容和设备设置。不要为了让功能恢复运行而重放被中断的外部操作。

缓存和索引可以重建。实体正文、业务记录、评论和通知回执不能当作缓存清理。浏览器 Cookie、CLI 账号与日志，需要按各自宿主提供的方式单独备份。

## 保存失败与冲突

读取失败、已损坏的文件或无法解析的受管区域会阻止写入。保存 JSON 文件时会把上一份有效快照保留为 `.backup`。主文件损坏且存在 `.backup` 时，NAND 加载备份，并把损坏的文件保留为 `.corrupt`；没有备份时，NAND 报告错误，并且不会覆盖该文件。图标使用自己的备份轮换规则，见[图标](icons.ZH.md#数据备份与关闭模块)。磁盘错误不会被显示为保存成功。

出现错误时，先保留当前输入，再检查权限、同步冲突和文件内容。支持重试的面板提供错误详情和重试；恢复草稿位于 `.nand/recovery/drafts/`。档案冲突时，先复制草稿，再重新载入原始资料；草稿 JSON 不是可直接导入的 Markdown。

不同字段或记录的并发修改可以合并，对同一字段的修改需要你来决定。原始笔记有未保存的编辑时，请先保存编辑器；NAND 不会绕过这个保护去写入。删除后的实体文件可能带有 `nand-deleted` 标记，这是逻辑删除，不是等待恢复的正常记录。

## 看板冲突

外部编辑与看板保存发生冲突时，NAND 暂停写入原看板，并把恢复副本保存到 `.nand/recovery/dashboard/conflicts/<id>.json`。提示中显示实际的文件路径。“副本已保存”不表示修改已写入原文；继续编辑会更新同一冲突的最新修订。

看板上的状态区提供“复制当前草稿”“复制副本路径”“重试保存”和“重新载入原文”。副本保存失败时页面保持打开：先复制草稿，修复磁盘或权限后再重试。重新载入需要确认，并保留恢复副本。副本是包含原始、当前和外部文本的 JSON，不能当作看板 Markdown 去覆盖看板。强制结束进程或磁盘不可写时，不能保证尚未落盘的输入被保存。

## 格式与语言

图片裁剪位置保存在看板 Markdown 中：`banner.imagePos` 按图片路径保存 `"x,y"` 字符串，卡片的 `coverPos` 行保存封面位置。坐标是 0 到 100 的整数百分比，未设置时为 `50,50`。只读时仅对显示归一化，越界值限制在范围内，无效值按居中显示，不自动改写原文。编辑或重置某张图片只改它的位置，其他原始条目（包括未使用的路径）保留，图片文件本身不变。

语言设置只影响界面，从不改变文件路径、身份标识、笔记正文或操作参数。
