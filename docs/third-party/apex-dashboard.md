# apex-dashboard 改编范围

当前布局、主题与交互固定参考 [apex-dashboard ac4d2c745d950b9c4d53d3fd33388204b0769841](https://github.com/PandoraReads/apex-dashboard/tree/ac4d2c745d950b9c4d53d3fd33388204b0769841)（v3.8.4）。根目录 LICENSE 为 MIT，Copyright (c) 2025 PandoraReads，以 LICENSE 原文为准，不采用 package.json 的 `0-BSD` 值。[NOTICE](../../NOTICE) 保留完整许可。

以下早期规则保留来源追溯：`core/board/board-codec.ts` 的粗高度换算、`core/board/focal-point.ts` 的焦点格式与裁剪语义，以及 `core/board/immersive-grid.ts` 的放置行为参考，仍来自 `db9d2892032c27f5f8899a72c0dca61d72572a9a`（v3.7.5）。这三个文件的原有来源头保持不变；新 React 界面仍参考 `ac4d2c7`。下表在历史来源行注明版本，其余现行映射对应 v3.8.4。

| NAND 源码 | 固定的上游源码 | 关系 |
|---|---|---|
| `src/modules/home/core/board/focal-point.ts` | `db9d289`（v3.7.5）的 `src/focal-point-picker.ts`、`src/parser.ts`（`imagePos`、`coverPos`） | 保留百分比字符串格式、默认居中和铺满裁剪的位置语义；仅在编辑对应图片时规范化原始非法值。 |
| `src/modules/home/ui/images/`、横幅与卡片编辑器 | `ac4d2c7`（v3.8.4）的 `src/focal-point-picker.ts` 及图片编辑入口 | NAND 使用懒加载 React 编辑器，提供键盘、数值输入及可取消的指针预览，并按明确的库资源重命名事件迁移引用；底层焦点格式沿用上行历史来源。 |
| `src/modules/home/core/board/board-codec.ts` | `db9d289`（v3.7.5）的 `src/immersive-grid.ts` 的 `migrateLegacyHeight` 与行转换、`src/parser.ts` 的 `parseImmersiveItems` | 改编旧 92px 高度单位到细行的转换和 `cap` 迁移标记。NAND 另行验证成对的有限坐标，并保留未知提供方引用。 |
| `src/modules/home/core/board/layout.ts` | `src/immersive-grid.ts` 的 `effectiveLayout`、`src/parser.ts` 的 `parseLayoutField` | 参考按板覆盖和手机显示回退的行为，由 NAND 独立实现。 |
| `src/modules/home/core/board/immersive-grid.ts` | `db9d289`（v3.7.5）的 `src/immersive-grid.ts`（`packImmersive`、`planImmersive`、`resolvePlacement`） | 参考放置行为。NAND 独立实现有限数校验、零基坐标、有效列数边界、仅限制高度的 cap、不重叠的显式位置，以及按障碍边界搜索最近空位。每行步长 10px，行跨度内包含底部 10px 视觉间距。 |
| `src/modules/home/core/board/types/model.ts`、`parser/parse.ts` | `src/types.ts`、`src/parser.ts` | 既有看板模型与解析器改编；新增成员和网格字段使用 NAND 的模块边界及现有文档保真写入器，不替换为上游的整篇序列化写入器。 |
| `src/modules/home/{core,platform,ui}/pipeline/` | `src/pipeline-model.ts`、`src/pipeline-due-modal.ts` | 参考根目录与状态匹配、可选阶段目录、笔记级 due/remind 字段的行为。NAND 分别实现纯规则、最新原文补丁、移动前冲突检查、显式重试未完成步骤，并接入既有自动化来源；不复制上游计时器、个人目录预设或单体渲染器。 |

成员标识、分区标识、分阶段写入网格数据、控件及贡献生命周期属于 NAND 自身架构。只读打开保留原文，显式布局或几何编辑才可提交标准化字段。上游“坐标从不持久化”的注释与解析器实现不一致；NAND 以实际坐标字段为依据并保留它们。

固定版本 `ac4d2c7`（v3.8.4）还提供以下行为参考，NAND 的实现复用既有服务和文档写入器：

| NAND 实现 | 固定的上游源码 | 行为与差异 |
|---|---|---|
| `src/modules/home/contrib/widgets.ts`、`ui/widgets/`、`ui/immersive/` | `src/immersive.ts`、`src/renderer.ts` | 共享目录、首个实例创建、成员移除和网格交互。NAND 每模块提供一个贡献包，独立管理生命周期，并使用可访问的原生控件；已保存的自动化快捷操作与内置组件使用同一注册表。 |
| `src/modules/home/core/board/skill-shortcuts.ts`、`services/skill-shortcuts.ts`、`ui/quickbar/{SkillList,SkillButtons}.tsx`、`ui/widgets/SkillWidget.tsx`、`src/shared/agent-dispatch.ts` | `src/agent-dispatch.ts`、`src/agent-prompt-modal.ts`、`src/skill-widget.ts` | 模板替换、预览、直发和交付结果。现行按钮编辑器手填技能名称并配置新会话目录，预览只编辑最终提示词；文件引用来自入口上下文。经智能体公开端口派发，分开记录交付与完成。不改编外部应用启动器。 |
| `src/modules/agent/` 技能发现、`src/modules/home/ui/skills/` | `src/skill-registry.ts` | 库内技能发现与已有名称记忆数据；额外目录必须明确指定。现行看板按钮编辑器不提供发现列表，也不在保存按钮时记忆名称；技能库通过公开目录接口发现。各 CLI 的直接调用语法按其官方文档核对，不猜测不支持的语法。 |
| `src/modules/home/core/board/board-experience.ts`、`ui/sections/types/LibrarySection.tsx` | `src/types.ts`、`src/parser.ts`、资料库与文件夹配置 | 多模板排序和创建时选择。明确空选择与缺省设置不同，只读打开旧文档保留原字节。 |
| `src/modules/home/core/board/table-columns.ts`、资料库与文件夹配置 | `src/table-columns-modal.ts`、`src/library-section.ts` | 各分区独立保存属性顺序与显隐，包括首屏之外的属性。NAND 增加键盘排序，并保留隐藏或暂时不存在的属性偏好。 |
| `src/modules/home/core/board/progressive-results.ts`、资料库渲染器 | `src/library-section.ts` | 首批 50 条、每次增加 50 条、显示上限 500 条。数量、筛选、排序和智能体范围仍使用全部匹配数据。 |
| `src/modules/home/core/anniversaries/`、`ui/widgets/AnniversaryDateEditor.tsx` | `src/anniversary-widget.ts`、`src/anniversary-settings-modal.ts` | 公农历输入以公历日期保存身份。NAND 明确处理闰月和小月，农历转换失败时不会静默替换为公历纪念日。 |
| `ui/appearance/AppearanceStudio.tsx`、`ui/appearance/appearance.ts` | `src/theme-studio-modal.ts`、`src/appearance.ts` | 外观工作室只保留背景图、模糊、表面不透明度、圆角与字号；Apex 的 13 套主题、自定义颜色和“我的主题”已删除，颜色由 NAND 全局令牌决定。 |
| `src/modules/home/ui/quickbar/DashboardIconPicker.tsx` | `src/icon-picker-modal.ts`、`src/icon-names.ts` | 常用建议、模糊搜索和最多 400 个显示结果。完整图标来自 Obsidian 已安装的目录，可选复用 NAND 关键词查询。 |
| `src/modules/home/ui/` 中的资料库与文件夹卡片控件 | `src/library-section.ts` | 悬停删除复用既有回收站操作；NAND 同时在键盘聚焦与触摸时显示按钮，确认框归属触发窗口并默认聚焦取消。 |

早期集成审查曾覆盖 Windows 的旧界面；它不是当前重构的跨平台验收。本轮对照使用 Linux Obsidian 1.13.7、默认主题与 Minimal 9.0.2；真实手机、Windows/macOS 当前界面及真实登录仍待人工验收。另行固定的 GPL home-pages 树仅供相似度脚本输出路径和数值，不作为实现来源。

本参考不整体搬入上游样式表、单体渲染器、设置持久化或外部智能体适配器；改编不包含 GPL 项目的实现代码。

## 核心布局、交互和主题（v3.8.4）

本轮首页以 `ac4d2c7` 为唯一布局与交互参照。`home/ui/theme/tokens.css` 把看板的 `--db-*` 变量全部接到 NAND 全局令牌（上游的 13 套主题和 `bridge.css` 已删除，侧栏、左右与上下布局也已删除，只保留沉浸网格画布）。`DashboardPage`、`canvas/`、`banner/`、`quickbar/`、`sections/`、`cards/` 与六个 P0 `*Widget.tsx` 对照上游 `view.ts`、`renderer.ts`、`banner.ts`、`quick-note-section.ts`、`library-section.ts` 与各小组件入口，文件头保留 MIT 来源。

`core/board/parser/__fixtures__/apex-dashboard-template.md` 是固定版本原始样本；解析与回写测试保留未知字段、缩进、子任务和文档树。`services/board-store.ts` 复用 NAND 的串行文档写入及受管内容层，不引入上游全局插件实例。工作台注册表存储为 `home.workspaces`，仅保留内存适配字段供现有服务使用。

旧页面入口、布局选择、组件目录界面、记录页和 home/styles 已移除；全部分区、小组件与统计使用现行 React 实现。

## 小组件与统计（v3.8.4）

番茄、习惯、记账、账本和阅读统计，以及农历/抽签、年度进度、日历、纪念日改为 React。布局配方在 `home/ui/theme/widget-classes.ts`，由上游对应选择器的声明转为静态 Tailwind 类；固定图表与签纸色通过同目录 `tokens.css` 的 `--db-record-*` 变量提供。对话框使用 NAND 的 shadcn/Radix 门户。旧 records 页面、侧栏和样式已删除，领域数据按 Apex JSON 写入 `.nand/content/NAND/`。

阶段 8b 同时移植 `src/capture-search-widgets.ts`、`src/skill-widget.ts` 的独立输入条与实体技能键布局；配置复用 NAND 的 React 技能编辑器，发送只通过 `AGENT_DISPATCH`。对应静态样式配方为 `input-widget-classes.ts`。

## 分区、沉浸与外观（v3.8.4）

P1 分区、沉浸网格（现为唯一的小组件画布）、统计横幅、外观工作室和完整看板设置继续以 `ac4d2c7` 为唯一参照，© 2025 PandoraReads，MIT。`ui/theme/p1-classes.ts` 与 `immersive-classes.ts` 将对应声明转换为静态 Tailwind 配方，固定颜色转为 `ui/theme/tokens.css` 中由 NAND 全局令牌派生的变量（Apex 的 13 套主题与 `bridge.css` 已删除）；不在运行时注入样式表。

| NAND 文件 | 上游入口 | 改编范围 |
|---|---|---|
| `ui/dataview/`、`ui/sections/P1Section.tsx` | `dataview-section.ts`、配置弹窗 | 结果视图、工具栏、实时语法反馈；复用 NAND 内置 DQL |
| `ui/media/`、`ui/web/`、`ui/pipeline/` | `media-section.ts`、`media-lightbox-modal.ts`、`web-section.ts`、`pipeline-section.ts` | React 分区、筛选、灯箱与工作流；文档修改仍走 NAND 内容层，技能经 `AGENT_DISPATCH` |
| `core/pm/`、`services/projects.ts`、`ui/pm/` | `pm-model.ts`、`pm-section.ts`、`pm-board-modal.ts` | 字段别名、里程碑/待办、项目卡与看板 |
| `services/skill-library.ts`、`ui/skills/{SkillsSection,SkillCard}.tsx` | `skill-store.ts`、`skill-section.ts`、`skill-detail-modal.ts` | 同名聚合、来源元数据、分组拖动、搜索、置顶、详情与实例回收；发现及调用使用智能体公开接口，本地导入副本归属 `.nand/content/NAND/技能/` |
| `ui/canvas/BoardCanvas.tsx` | `immersive.ts` | 12 列网格、移动与缩放、编辑模式；复用 NAND 纯网格算法与 ownerDocument 控制器；添加小组件面板与尺寸档为 NAND 新增 |
| `ui/banner/BannerStats.tsx`、`BannerStatsPanel.tsx`、`BannerStatsEditor.tsx` | `banner-stats.ts`、`banner-edit-modal.ts` | 三栏统计、热力图与配置 |
| `ui/appearance/AppearanceStudio.tsx` | `theme-studio-modal.ts`、`appearance.ts` | 背景、毛玻璃、圆角与即时预览；颜色与命名主题已删除；Radix 门户与焦点归属所属窗口 |
| `ui/settings/`、`services/board-backups.ts` | `settings.ts`、`backup-service.ts` | React 三标签设置；看板备份写入 NAND 恢复目录，恢复仅允许当前看板列表 |

无新增依赖。被替换且无引用的旧设置、主题弹窗、沉浸渲染入口和旧界面适配器已删除；已失去调用方的渲染适配器随收尾删除，测试转为现行组件或模型入口。

## RSS、服务分区、媒体与备份（v3.8.4）

以下路径相对 `src/modules/home/`；来源仍为固定提交 `ac4d2c7`。

| 上游入口 | NAND | 范围 |
|---|---|---|
| `rss-section.ts`、`rss-service.ts`、`rss-store.ts`、`rss-note.ts` 及配置/阅读弹窗 | `core/rss/`、`platform/rss/`、`ui/rss/` | RSS/Atom、正文提取、OPML、分组、阅读与文章保存 |
| `weread-section.ts`、`weread-config-modal.ts` | `ui/weread/` | 书架、筛选与统计；复用 NAND 服务与设备凭据 |
| `ticktick-section.ts`、`ticktick-service.ts`、`ticktick-login-modal.ts`、`ticktick-task-edit-modal.ts`、`ticktick-tz.ts` | `core/ticktick/`、`platform/ticktick/`、`ui/ticktick/` | 清单/卡片、任务编辑、时区与账号授权；设备数据隔离 |
| `music-widget.ts`、`album-widget.ts`、`album-settings-modal.ts` | `ui/widgets/` 及对应面板 | 音乐搜索/播放与相册多实例；所属窗口弹层与可见性清理 |
| `backup-service.ts` | `services/board-backups.ts` | 分组备份看板和记录，来源/完整性清单、同工作台恢复与覆盖前副本 |

所有看板对话框在所属窗口居中。对照几何以组件原点归一化，保留 Apex 内部布局，不声称与受 contain 约束的上游弹窗整屏坐标一致。服务、受管内容、模块生命周期与设备归属继续使用 NAND 架构。
