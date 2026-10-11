[English](apex-dashboard.md) | 简体中文

# apex-dashboard 参考

首页看板设计部分源于 [apex-dashboard](https://github.com/PandoraReads/apex-dashboard)。布局和高度读写审查固定使用提交 [`db9d2892032c27f5f8899a72c0dca61d72572a9a`](https://github.com/PandoraReads/apex-dashboard/tree/db9d2892032c27f5f8899a72c0dca61d72572a9a)，其 manifest 版本为 3.7.5。根目录 [LICENSE](https://github.com/PandoraReads/apex-dashboard/blob/db9d2892032c27f5f8899a72c0dca61d72572a9a/LICENSE) 为 MIT，版权属于 2025 PandoraReads。[NOTICE](../../NOTICE) 保留完整 MIT 声明；改编许可不采用 package 元数据里的 `0-BSD` 值。

| NAND 源码 | 固定的上游源码 | 关系 |
|---|---|---|
| `src/modules/home/core/board/focal-point.ts`、`ui/images/`、横幅与卡片编辑器 | `src/focal-point-picker.ts`、`src/parser.ts`（`imagePos`、`coverPos`） | 改编百分比字符串格式、默认居中和铺满裁剪的位置语义。NAND 使用懒加载 Preact 编辑器，提供键盘、数值输入及可取消的指针预览；仅在编辑对应图片时规范化原始非法值，并按明确的库资源重命名事件迁移引用。 |
| `src/modules/home/core/board/board-codec.ts` | `src/immersive-grid.ts` 的 `migrateLegacyHeight` 与行转换、`src/parser.ts` 的 `parseImmersiveItems` | 改编旧 92px 高度单位到细行的转换和 `cap` 迁移标记。NAND 另行验证成对的有限坐标，并保留未知提供方引用。 |
| `src/modules/home/core/board/layout.ts` | `src/immersive-grid.ts` 的 `effectiveLayout`、`src/parser.ts` 的 `parseLayoutField` | 参考按板覆盖和手机显示回退的行为，由 NAND 独立实现。 |
| `src/modules/home/core/board/immersive-grid.ts` | `src/immersive-grid.ts`（`packImmersive`、`planImmersive`、`resolvePlacement`） | 参考放置行为。NAND 独立实现有限数校验、零基坐标、有效列数边界、仅限制高度的 cap、不重叠的显式位置，以及按障碍边界搜索最近空位。每行步长 10px，行跨度内包含底部 10px 视觉间距。 |
| `src/modules/home/core/board/types/model.ts`、`parser/parse.ts` | `src/types.ts`、`src/parser.ts` | 既有看板模型与解析器改编；新增成员和网格字段使用 NAND 的模块边界及现有文档保真写入器，不替换为上游的整篇序列化写入器。 |
| `src/modules/home/{core,platform,ui}/pipeline/` | `src/pipeline-model.ts`、`src/pipeline-due-modal.ts` | 参考根目录与状态匹配、可选阶段目录、笔记级 due/remind 字段的行为。NAND 分别实现纯规则、最新原文补丁、移动前冲突检查、显式重试未完成步骤，并接入既有自动化来源；不复制上游计时器、个人目录预设或单体渲染器。 |

成员标识、分区标识、分阶段写入网格数据、Preact 控件及贡献生命周期属于 NAND 自身架构。只读打开保留原文，显式布局或几何编辑才可提交标准化字段。上游“坐标从不持久化”的注释与解析器实现不一致；NAND 以实际坐标字段为依据并保留它们。

同一固定版本还提供以下行为参考，NAND 的实现复用既有服务和文档写入器：

| NAND 实现 | 固定的上游源码 | 行为与差异 |
|---|---|---|
| `src/modules/home/contrib/widgets.ts`、`ui/widgets/`、`ui/immersive/` | `src/immersive.ts`、`src/renderer.ts` | 共享目录、首个实例创建、成员移除和网格交互。NAND 每模块提供一个贡献包，独立管理生命周期，并使用可访问的原生控件；新闻和已保存的自动化快捷操作与内置组件使用同一注册表。 |
| `src/modules/home/core/board/skill-shortcuts.ts`、`services/skill-shortcuts.ts`、`ui/skills/`、`src/shared/agent-dispatch.ts` | `src/agent-dispatch.ts`、`src/agent-prompt-modal.ts`、`src/skill-widget.ts` | 模板替换、预览、直发和交付结果。NAND 的最终提示词可编辑，文件可明确选择，经智能体公开端口派发，分开记录交付与完成；已有会话仅粘贴。不改编外部应用启动器。 |
| `src/modules/agent/` 技能发现、`src/modules/home/ui/skills/` | `src/skill-registry.ts` | 库内技能发现与名称记忆。额外目录必须明确指定，各 CLI 的直接调用语法按其官方文档核对，不猜测不支持的语法。 |
| `src/modules/home/core/board/board-experience.ts`、`ui/ui/template-modal.ts` | `src/types.ts`、`src/parser.ts`、资料库与文件夹配置 | 多模板排序和创建时选择。明确空选择与缺省设置不同，只读打开旧文档保留原字节。 |
| `src/modules/home/core/board/table-columns.ts`、资料库与文件夹配置 | `src/table-columns-modal.ts`、`src/library-section.ts` | 各分区独立保存属性顺序与显隐，包括首屏之外的属性。NAND 增加键盘排序，并保留隐藏或暂时不存在的属性偏好。 |
| `src/modules/home/core/board/progressive-results.ts`、资料库渲染器 | `src/library-section.ts` | 首批 50 条、每次增加 50 条、显示上限 500 条。数量、筛选、排序和智能体范围仍使用全部匹配数据。 |
| `src/modules/home/core/anniversaries/`、`ui/widgets/AnniversaryDateEditor.tsx` | `src/anniversary-widget.ts`、`src/anniversary-settings-modal.ts` | 公农历输入以公历日期保存身份。NAND 明确处理闰月和小月，农历转换失败时不会静默替换为公历纪念日。 |
| `src/modules/home/services/appearance-presets.ts`、`ui/appearance/` | `src/theme-studio-modal.ts` | 命名外观的保存、应用和删除。NAND 同时保存及恢复共享主题服务与首页装饰，并更新所有窗口，不建立独立私有调色板。 |
| `src/modules/home/ui/ui/icon-picker-modal.ts` | `src/icon-picker-modal.ts`、`src/icon-names.ts` | 常用建议、模糊搜索和最多 400 个显示结果。完整图标来自 Obsidian 已安装的目录，可选复用 NAND 关键词查询。 |
| `src/modules/home/ui/` 中的资料库与文件夹卡片控件 | `src/library-section.ts` | 悬停删除复用既有回收站操作；NAND 同时在键盘聚焦与触摸时显示按钮，确认框归属触发窗口并默认聚焦取消。 |

集成审查在真实 Windows Obsidian 中覆盖全部 14 种内置组件和三种新闻组件，包括模块可用性、布局持久化、重启和减少动效。真实手机、其他操作系统及登录后的模型执行仍未验证。另行固定的 GPL home-pages 树仅供相似度脚本输出路径和数值，不作为实现来源。

本参考不整体搬入上游样式表、单体渲染器、设置持久化或外部智能体适配器；改编不包含 GPL 项目的实现代码。
