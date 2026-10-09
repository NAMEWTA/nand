---
schema_version: 1
artifact: "source"
change: "2026-10-08-home-grid-rebuild"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/137"
captured_at: "2026-10-09T03:56:57.011Z"
content_sha256: "874c49e47bd0c17a30e26516694ff31152285b867f9161af65203e971d58fc7d"
remote_state: "open"
close_capability: "supported"
---

# Source: #137 [看板][重构] 全面参考 apex-dashboard 深度仿造并完整重构首页看板：沉浸式自由网格、小组件注册机制与 AI Agent 技能快捷派发

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T14:54:24Z / 2026-10-08T14:54:24Z
- Labels: ["enhancement"]
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:56:57.011Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 874c49e47bd0c17a30e26516694ff31152285b867f9161af65203e971d58fc7d。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content

## 背景

NAND 的首页看板（工作台 `nand-workbench-view` 中的 `dashboard` 功能，代码在 `src/modules/home`）当初就是参考 [PandoraReads/apex-dashboard](https://github.com/PandoraReads/apex-dashboard) 做的。两者思路一致：横幅、分区、组件化的小组件，内容以 Markdown + YAML 持久化，并且可以拖拽。`NOTICE` 中已有 apex-dashboard 的 MIT 声明。

此后 apex-dashboard 持续迭代到 **3.7.5**，新增了沉浸式自由网格、按看板的小组件成员、工作流分区、RSS 分区，以及 AI Agent 技能快捷派发等能力。NAND 则停留在早期分叉点：`NOTICE` 没有记录 commit。按 NAND 首个提交（2026-09-25）和现有功能推断，分叉点约在 apex 3.6.3 前后，而 apex 3.6.5 发布于 2026-09-28。

本 issue 要求**全面参考 apex-dashboard，对首页看板进行深度仿造和完整重构**。范围包括：

- 看板的布局、拖拽、缩放与小组件体系；
- apex 中其他值得仿造的功能，**重点是 AI Agent 的快捷使用方式**。

前提是符合 NAND 现有的代码规范，并复用已实现的功能。

### 参考基线与许可

| 项 | 值 |
|---|---|
| 主参考仓库 | https://github.com/PandoraReads/apex-dashboard |
| 固定 commit | `db9d2892032c27f5f8899a72c0dca61d72572a9a`（2026-10-08 18:18 UTC+8，`manifest.json` 版本 3.7.5） |
| LICENSE | **MIT**，`Copyright (c) 2025 PandoraReads` |
| 注意 | apex 的 `package.json` 写的是 `"license": "0-BSD"`，与 LICENSE 文件不一致；以 LICENSE 文件（MIT）为准，按 MIT 要求保留版权和许可声明 |

### 代码处理原则（明确允许复制）

apex-dashboard 是 MIT 许可，**允许直接复制、仿写其代码与设计，再增强优化**。具体规则：

1. **原代码没问题，就直接复制。** 文件头加来源注释，例如 `// Adapted from apex-dashboard (MIT) @ db9d289, src/immersive-grid.ts. Copyright (c) 2025 PandoraReads.`。
2. **原代码有问题，先优化、升级、重构，再放回项目。** "有问题"指违反下文 NAND 硬约束，或有 bug、缺可访问性、性能隐患。即使改动很大，只要源自 apex，同样保留来源注释。
3. **更新 `NOTICE` 中 apex-dashboard 一节**：补上固定 commit，并说明本次仿造的范围。参照 `docs/third-party/orca-terminal-workbench.md` 的做法，新建 `docs/third-party/apex-dashboard.md`，记录 commit 和「apex 文件 → NAND 文件」的映射。
4. 不得删除或改写 apex 的版权声明。

补充参考：[jepicaju862-lab/home-pages](https://github.com/jepicaju862-lab/home-pages) 是 **GPL-3.0-only** 许可（参考点为 v0.3.1，commit `2f98a7c`）。按 `.agents/skills/dev/references/licensing.md` 的规定，GPL 项目**只能参考公开行为和用户可见的概念，不能打开源码照写，也不能转述代码**。它在编辑模式、指针拖拽排序、角落缩放、FLIP 动画方面的交互体验可以作为行为参考。建议把它加入 `scripts/check-similarity.mjs` 的对照树。

---

## 一、apex-dashboard 参考拆解（@ db9d289）

### 1. 沉浸式布局（3.7.0 起，核心参考）

- **数据模型**：在看板 frontmatter 中按看板选择布局（`layout:`，见 `src/parser.ts` 约 L120 的序列化）。沉浸式看板的所有卡片存放在 `immersive:` 列表中（同文件约 L221；默认卡片 `IMMERSIVE_DEFAULT_TILES` 约在 L698）。`ImmersiveItem` 定义在 `src/types.ts` 约 L20，`DashboardData.layout` / `.immersive` 约在 L1140。
- **网格**：`src/immersive-grid.ts`（299 行），12 列（`IMM_COLS`），行单位 10px（`IMM_ROW_UNIT`），间距 10px，最小 3 行。函数包括：
  - 打包：`packImmersive`（skyline）、`planImmersive`；
  - 校正：`normalizeImmersive`、`clampSpanW/H`；
  - 冲突检测与落点：`overlapsAny`、`resolvePlacement`；
  - 旧数据迁移：`migrateLegacyHeight`。

  小组件（`widgetItemId`）、分区（`sectionItemId`）和卡片放在**同一张网格**里。
- **渲染与交互**：`src/immersive.ts`（1153 行）
  - `layoutImmersiveGrid` / `refitImmersiveGrid` / `observeImmersiveGrid`：按内容自适应高度，用 ResizeObserver 重新排布；
  - `setupImmersiveDnD`：基于 pointer 的移动，带落点幽灵、边缘自动滚动；主要重叠时交换位置，否则就近找空位；吸附到相邻卡片边缘（8px）；
  - `attachImmersiveResizeHandle`：边和角缩放，通过 `src/drag-guard.ts` 防止误触；
  - `immersiveWidgetCatalog` / `openImmersiveAddMenu`：添加菜单。小组件按看板成员管理（`src/renderer.ts` 约 L501 的 `buildWidgetEntries` 与 `memberKeys`）。3.7.5 起，没有实例的相册、倒计时、纪念日显示「新建…」，点击就地创建并自动落卡；
  - `setupImmersiveTileMenu` / `attachImmersiveWidgetDelete`：右键菜单或 × 移除卡片；
  - `effectiveLayout`：手机端回退到 side 布局。
- **已知不足（NAND 版要补上）**：沉浸式交互没有键盘操作，没有 Esc 取消拖拽，也没有针对 reduced-motion 的处理。

### 2. 传统布局的拖拽（与 NAND 现状基本同源）

- `src/dnd.ts`（566 行）：HTML5 拖拽，加上触屏长按路径。
- `src/drag-guard.ts`、`src/widget-span.ts`、`src/column-pairs.ts`：防误触、小组件跨度、列配对。

### 3. AI Agent 快捷使用（3.7.3–3.7.5，重点参考）

- **技能按钮（`SkillShortcut`，`src/types.ts` 约 L379）** 出现在三个位置：
  - 快念（quick-note）操作条；
  - 独立的「技能按钮」小组件（`src/skill-widget.ts`）；
  - 工作流分区的列头和卡片（`PipelineSkill`，作用范围 `scope: 'stage' | 'card'`）。
- **确认弹窗**：`src/agent-prompt-modal.ts`
  - 发送前预览并编辑最终 prompt，可补充本次输入，可选择文件范围（`{paths}`）；
  - 点击发送后立即关闭，结果通过通知反馈（3.7.5）；
  - 每个技能可单独勾选「免预览直接发送」（`directSend`）。旧的分区级开关会自动迁移为各技能的勾选状态（3.7.5）。
- **派发层**：`src/agent-dispatch.ts`（301 行）
  - `buildAgentPrompt`：模板支持 `{skill}` / `{input}` 等变量。技能 token 按目标规范化：Claudian、Codex、ZCode 用 `$name`，Copilot 用 `/name`。`isValidSkillName` 用正则校验技能名；
  - `AgentAdapter` 注册表，`AgentKind = 'in-app' | 'terminal' | 'deep-link' | 'clipboard-app'`。已接入的目标：Claudian（应用内）、Copilot（应用内）、Codex Desktop（`codex://threads/new?prompt=&path=` deep link）、ZCode（剪贴板加 macOS `open`）；
  - 发送带 10 秒超时，错误分为 `AgentBridgeError` 的 `missing / unsupported / chat / busy` 四类。
- **技能注册表**：`src/skill-registry.ts`（249 行）
  - 按 agent 记住用过的技能名；
  - 自动发现库内的 `.claude/skills`、`.codex/skills`；桌面端还会扫描额外目录，支持 `~` 展开；
  - 用 `parseSkillDocName` 读取技能文档的名称；
  - `attachSkillPicker` 提供技能选择器。
- **上下文变量**：`src/pipeline-model.ts` 的 `cardSkillVars` / `stageSkillVars` 提供 `path / title / stage / folder` 等模板变量。

### 4. 其他值得仿造的功能（3.6.5–3.7.5）

| apex 功能 | apex 位置 | 说明 |
|---|---|---|
| 工作流分区 | `src/pipeline-section.ts`、`pipeline-model.ts`、`pipeline-config-modal.ts`、`pipeline-due-modal.ts` | 选题 → 草稿 → 审核 → 发布 → 复盘逐列推进。拖拽卡片即写入状态字段并归档到对应子目录；带截止时间与提醒、勾选清单、筛选栏、可拖拽列宽，卡片和列头上有技能按钮 |
| RSS 分区 | `src/rss-*.ts`（section/service/store/xml/opml/readability/article-modal/note/config-modal） | 与 NAMEWTA/nand#136 的新闻模块相关，由 #136 决定取舍，本 issue 只提供小组件注册机制 |
| 多模板新建笔记 | 分区配置（3.6.5） | 「新笔记模板」可多选，旧的单模板设置自动迁移 |
| 表格列显隐与排序 | `src/table-columns-modal.ts` | 每个分区单独记忆 |
| 大库渐进渲染 | 分组和看板视图（3.6.5、3.6.6） | 每组先渲染 50 条，加「显示更多」，超过上限截断并提示 |
| 纪念日农历 | 3.6.5 | 存储始终为阳历，可无损往返，提醒按农历周年映射 |
| 封面与横幅焦点 | `src/focal-point-picker.ts` | 拖拽选择焦点，多图轮播各自记忆 |
| 外观工作室保存主题 | `src/theme-studio-modal.ts`（3.6.6） | 自定义外观可保存为主题并一键切换 |
| 全量图标选择器 | `src/icon-picker-modal.ts` + `src/icon-names.ts`（1876 个 Lucide 图标，附提取脚本） | 常用图标置顶，其余模糊搜索 |
| 卡片悬停删除 | 3.6.5 | 数据库和文件夹分区的卡片悬停时右上角直接显示删除按钮 |

---

## 二、差距对比（NAND 现状 @ main `21f852b`）

| 方面 | apex 3.7.5 | NAND 现状（路径） | 差距 / 要求 |
|---|---|---|---|
| 布局模式 | `side / stacked / immersive`，每个看板通过 `layout:` 单独选择 | `src/modules/home/core/board/types/model.ts` L13 中 `DashboardLayoutMode = 'side' \| 'stacked'`；`src/shell/board-settings.ts` 强制使用 stacked | 新增沉浸式自由网格，并支持按看板选择 |
| 看板数据 | `DashboardData` 带 `layout` / `immersive` | `model.ts` L790–798 的 `DashboardData` 没有这两个字段 | 扩展模型和 parser，golden 往返测试必须覆盖 |
| 卡片网格尺寸 | 统一的 `x/y/w/h` 网格坐标 | `model.ts` L488–517 的 `DashboardCard.gridCols/gridRows` 从未接到 UI；`src/modules/home/ui/render-contract.ts` L74–75 定义了 `onCardGridChange / onCardGridMove` 但未使用；尺寸逻辑在 `ui/renderer/render-card.tsx` L44–51 | 接入网格数据，统一尺寸来源 |
| 小组件体系 | 按看板的成员（`memberKeys`）、添加菜单、「新建…」 | `ui/renderer/render-sidebar-widgets.ts` L183–290 硬编码小组件和全局开关；顺序存在 `model.ts` L130 的 `widgetOrder`（全局） | 改为注册表驱动，并按看板记录成员 |
| 拖拽 | 沉浸式用 pointer 移动、缩放、吸附、交换、幽灵；传统布局用 `dnd.ts` | `ui/ui/dnd.ts` 与 apex `dnd.ts` 几乎相同（HTML5 加长按）；`ui/ui/drag-guard.ts` 相同；`ui/widgets/widget-span.ts`、`core/board/column-pairs.ts` 基本相同；`setupWidgetDnD` 在 `ui/renderer/refresh-sidebar-weather-widget.ts` L22 | 移植 pointer 引擎，并补上键盘操作、Esc 取消和 reduced-motion |
| 其他模块贡献小组件 | 无（单体插件） | 无注册机制；#136 要求新闻模块通过自己的 `api.ts` 贡献小组件 | 新建 `HOME_WIDGETS` 贡献点（见下文） |
| 看板管理 | 切换器中可新建、选择布局 | `ui/workbench-panel.ts` 的看板菜单只有重命名和删除，而 `home/api.ts` 的 `BoardOperations` 已有 reorder | 补上排序和布局选择的入口 |
| 新笔记模板 | 多选 | `model.ts` L586 只有单个 `templatePath` | 改为多模板，自动迁移 |
| 纪念日 | 支持农历 | `model.ts` L648 起的 `AnniversaryConfig` 没有农历字段，`core/anniversaries` 没有农历逻辑（农历目前只有 `ui/widgets/lunar-*` 的展示小组件） | 复用 `lunar-compute.ts` 实现农历纪念日 |
| 图标选择器 | 1876 个，可模糊搜索 | `ui/ui/icon-picker-modal.ts` 的 `ICONS` 是约 74 个精选图标 | 改为全量，并复用 icons 模块的资源 |
| 焦点调整、表格列配置、保存主题、渐进渲染 | 有 | 在 `src/modules/home` 中没有找到对应实现（`ui/appearance/theme-studio-modal.ts` 有实时应用，但不能保存为主题） | 按「一、4」逐项仿造 |
| AI Agent 快捷使用 | 技能按钮、确认弹窗、多目标派发、技能注册表 | 见下一节 | 见下一节 |

---

## 三、AI Agent 快捷使用：apex 与 NAND 逐项对比

NAND 已有的相关能力：

- 终端智能体模块 `src/modules/agent`：PTY 终端加 `nand-pty` helper，支持 Claude Code、Codex、Gemini、OpenCode、Pi、Grok；有自定义启动预设、历史和用量。见 `docs/agent-workbench.md`。
- 跨模块服务：`AGENT_SESSIONS`（`src/modules/agent/api.ts`，`list()` / `attachMaterial()`，把材料作为一个未发送的块粘贴进会话）。`AUTOMATION_AGENT_RUNTIME`（`src/modules/automations/api.ts` L36，`AgentRuntimePort` 定义在 `src/shared/automation/types.ts` L104）。
- 自动化的 Agent 动作：`{ agentId, cwd, prompt, sessionMode: 'fresh' | 'reuse' | 'specific' }`（`src/shared/automation/types.ts` L36–41）。不设时间时保存为手动快捷操作，可以固定到看板（`model.ts` L415 中 `QuickAction.type = 'action'`）。见 `docs/automation.md`。
- 把选区、当前笔记或文件路径发送到终端的命令（以粘贴方式，不回车）。

| 能力 | apex | NAND | 要求 |
|---|---|---|---|
| 一键派活入口 | 技能按钮在快念条、技能小组件、工作流卡片和列头上 | 看板快捷操作只能引用自动化定义（`QuickAction.type='action'`） | 新增「技能按钮」小组件，快念条和卡片也接入技能按钮 |
| Prompt 模板 | `{skill}` / `{input}` / `{paths}` / `{path}` / `{title}` / `{stage}` / `{folder}` | 自动化的 `prompt` 是固定文本，没有变量 | 在共享层加纯函数 `buildAgentPrompt`（可直接复制 apex 的实现），变量由调用方提供，例如当前笔记、选区、卡片文件 |
| 发送前确认与补充输入 | `AgentPromptModal`：预览、编辑、补充输入、选择文件范围；点击即关闭 | 无（运行即按固定 prompt 启动） | 仿造确认弹窗，改写为 Preact 加 NAND 设计 token，支持键盘，Esc 关闭 |
| 免预览直发 | 每个技能单独设置 `directSend` | 「立即运行」等同于直发 | 每个按钮可单独设置 |
| 技能发现 | 记住用过的技能名，发现 `.claude/skills` / `.codex/skills`，桌面端扫描额外目录，带选择器 | 无 | 发现库内的 `.agents/skills`、`.claude/skills`、`.codex/skills`（用 vault adapter 读取）；扫描用户主目录仅限 `desktop/` 目录内的代码 |
| 技能 token 规范化 | 按目标转成 `$` 或 `/` | 无 | 按 NAND agent 的 id 映射：Claude Code 用 `/`，Codex 用 `$`，其余在实现时按各 CLI 文档确认 |
| 派发目标 | Claudian、Copilot（应用内），Codex Desktop（deep link），ZCode（剪贴板） | 6 个 PTY CLI，会话模式有新建、复用、指定会话 | **以 NAND 终端 agent 为主目标**：新会话走 `AgentRuntimePort.start`；发到已有会话走 `AGENT_SESSIONS.attachMaterial`（只粘贴，不自动回车，保持现有安全语义）。apex 的外部适配器作为可选的适配器扩展 |
| 错误与超时 | 10 秒超时，`missing / unsupported / chat / busy` 四类 | 自动化有运行记录和状态（完成状态未知时不做猜测） | 复用自动化的运行记录和通知；派发层错误按 apex 分类后，用 i18n 文案提示 |

**设计约束**：

- 技能按钮的数据存放在看板 Markdown（YAML）或 `home` 设置命名空间中，具体由实现时决定，但必须有 golden 测试。
- 不复制 apex 的 `saveData` 存储方式。
- 派发统一经过 agent 模块 `api.ts` 暴露的服务，home 模块不直接 import agent 内部代码。
- agent 模块关闭时，按钮显示不可用占位，不报错。

---

## 四、重构要求

### 4.1 沉浸式自由网格（移植 apex，并增强）

- [ ] 布局模式扩展为 `side | stacked | immersive`，每个看板单独选择。模型、parser 和序列化参照 apex 的 `layout:` / `immersive:`。
- [ ] 直接复制 `immersive-grid.ts` 的纯算法（打包、校正、落点、迁移），配单元测试。
- [ ] 把 `immersive.ts` 的交互改写为 NAND 的模块化结构：`core/` 放纯算法，`ui/` 放 Preact 组件和 pointer 控制器；不使用 dnd-kit 一类的库。需要支持移动、边角缩放、吸附、交换、落点幽灵和边缘自动滚动。
- [ ] 增强：
  - 键盘操作：焦点在卡片上时，方向键移动，Shift+方向键缩放，Enter/Space 拾起或放下；
  - Esc 取消拖拽并恢复原位；
  - `prefers-reduced-motion` 时关闭过渡动画；
  - 窄宽度下按列数降级；
  - 手机端回退规则与 apex 一致；
  - 读屏播报位置变化。
- [ ] 添加菜单：按看板管理成员，无实例的小组件提供「新建…」，支持右键菜单和 × 移除。
- [ ] 卡片的 `gridCols/gridRows`、`onCardGridChange/onCardGridMove` 要么接入，要么删除，不保留死代码。

### 4.2 小组件注册机制（供其他模块使用，关联 #136）

- [ ] 在 `src/modules/home/api.ts` 中用 `contributionPoint` 定义 `HOME_WIDGETS`（参照 `src/app/contracts/module.ts` L34 和 `src/modules/automations/api.ts` L33 的 `AUTOMATION_SOURCES` 写法）。贡献项至少包含 `key`、`name`、`icon`、`render(host, ctx)`、`dispose`，以及默认尺寸和最小尺寸，可选声明「可多实例」和配置入口。
- [ ] 把 `render-sidebar-widgets.ts` 中硬编码的内置小组件逐个改为通过注册表注册，内置和外部一视同仁。
- [ ] 贡献方模块关闭时，显示占位（「在设置中开启」），不丢失布局。
- [ ] #136 的新闻模块、技能按钮小组件、自动化快捷操作都通过 `HOME_WIDGETS` 接入。
- [ ] 文档写入 `docs/dashboard.md` 和模块开发说明。

### 4.3 旧配置迁移

- [ ] 迁移以下旧数据：
  - 全局 `widgetOrder` 和小组件开关 → 各看板的成员与顺序；
  - stacked / side 的高度比例、列的半宽 / 宽度 / 高度 → 沉浸式坐标（仅在用户切换到沉浸式时生成，参照 apex 的 `normalizeImmersive` / `migrateLegacyHeight`）；
  - 单个 `templatePath` → 模板列表；
  - 未使用的 `gridCols` → 清理；
  - `layoutMode` → 每个看板的 `layout`。
- [ ] 迁移是惰性的：读取时转换，**在用户编辑之前不写回**。旧格式的往返结果逐字节不变，由 `test/golden/user-formats.test.ts` 锁定。
- [ ] 迁移失败时回退到默认布局，并给出提示，不能损坏笔记。

### 4.4 AI Agent 快捷使用

按「三」的要求实现：技能按钮小组件、快念条与卡片技能、确认弹窗、`directSend`、模板变量、技能发现与选择器、经 agent 模块 `api.ts` 派发。

### 4.5 其他仿造项

按「一、4」逐项实现：多模板、表格列显隐与排序、渐进渲染、农历纪念日、焦点调整、保存主题、全量图标、卡片悬停删除。工作流分区作为独立的 home 分区类型仿造（列推进时写入状态并归档，卡片和列头带技能按钮）。RSS 交给 #136。

---

## 五、硬约束：符合 NAND 规范并复用已有实现

这些约束来自 `.agents/skills/dev/SKILL.md`、`.agents/skills/ui/SKILL.md` 及其 references（`licensing.md`、`design-system.md`、`motion-a11y.md`）、`tsconfig.json`、`eslint.config.mts`。apex 代码凡与以下任何一条冲突，都算「有问题」，必须先改造再合入。

1. **分区（zone）结构**：遵循 `app / shell / ui / theme / host / shared / modules/<id>/{core, platform, services, contrib, ui}`。`core` 只放纯逻辑，跨模块只通过 `api.ts` 的 `serviceKey` / `contributionPoint` 交互；需通过 `pnpm run test:architecture`。
2. **Node / Electron 只能出现在 `desktop/` 目录**。eslint 在非 desktop 目录禁止 `process`、`Buffer` 等全局变量和 Node 模块。apex `agent-dispatch.ts` 中的 `require('child_process')`、检测 macOS 的 `/Applications` 都必须移到 `desktop/` 适配层，并在移动端优雅降级。
3. **TypeScript 严格模式**：开启 `strict`、`noUncheckedIndexedAccess`、`noImplicitReturns` 等；eslint（含 `eslint-plugin-obsidianmd` 和 `nand/no-obsidian-thenable`）零警告。禁用全局 `app`、`fetch`（改用 `requestUrl`）和 `localStorage`。
4. **UI**：用 Preact 和设计 token，不写字面量颜色。apex `styles.css` 约 25k 行，包含近 800 处十六进制颜色和个人化注释，**不能整段搬运**，需要改写为 token，并通过 `pnpm run lint:css` / `check:styles`。apex 的马卡龙、胶囊等皮肤风格只作为可选主题方向。
5. **i18n**：所有文案通过 `t()`，放在各模块的 `i18n.ts` 中。不搬 apex 3742 行的单体 `i18n.ts`。
6. **设置与存储**：设置放在 `home` 命名空间（`.nand/config/settings.json`），看板内容放 Markdown + YAML，不使用 apex 的 `saveData` 单文件存储。
7. **懒加载与体积**：沉浸式引擎、工作流分区、技能弹窗、图标全集都按需 `import()`，启动体积预算 120 KiB，需通过 `pnpm run check:bundle`。图标全集优先复用 `src/modules/icons` 已有的资源。
8. **可访问性和动效**：键盘可达、焦点可见、尊重 reduced-motion，按 `motion-a11y.md` 执行。
9. **复用已实现的功能**，不另起炉灶：
   - Agent 走 `AGENT_SESSIONS` 和 `AUTOMATION_AGENT_RUNTIME`；
   - 运行记录和通知走自动化与通知模块；
   - 农历走 `ui/widgets/lunar-compute.ts`；
   - 外观走 `ui/appearance/theme-studio-modal.ts`，保存的主题不能与 ADR-0020 冲突；
   - 看板操作走 `home/api.ts` 的 `BoardOperations`。
10. **许可**：遵守 MIT 署名要求（文件头、`NOTICE`、commit 映射文档），需通过 `pnpm run check:notices`。GPL 参考不进代码。
11. **测试与文档**：新增或修改的格式要有 golden 测试，纯算法要有单元测试，`pnpm test` 全部通过。同步更新 `docs/dashboard.md`、`docs/workbench.md`、`docs/agent-workbench.md`、`docs/data.md`。

---

## 六、分阶段计划

1. **P0 基线与许可**：固定 apex commit，更新 `NOTICE`，新建 `docs/third-party/apex-dashboard.md`（含文件映射表）；把 home-pages 加入相似度对照。
2. **P1 模型与迁移**：加入 `layout` / `immersive` 模型、parser 与序列化、惰性迁移和 golden 测试；移植 `immersive-grid` 纯算法和测试。
3. **P2 小组件注册表**：建立 `HOME_WIDGETS` 贡献点，把内置小组件改为注册表驱动，按看板管理成员，实现添加菜单；与 #136 对齐接口。
4. **P3 沉浸式交互**：pointer 移动、缩放、吸附、交换，加上键盘、Esc、reduced-motion、窄屏降级和读屏播报；看板管理补上排序和布局选择。
5. **P4 AI Agent 快捷使用**：`buildAgentPrompt`、技能注册表与发现、确认弹窗、技能按钮小组件、快念条和卡片技能，经 agent 和自动化服务派发。
6. **P5 其他仿造项**：工作流分区、多模板、表格列、渐进渲染、农历纪念日、焦点调整、保存主题、全量图标、悬停删除。
7. **P6 收尾**：完善文档，做性能与体积核查，在移动端回归测试。

每个阶段单独提 PR，并通过 lint、test、architecture、bundle、styles、notices 等检查。

---

## 七、验收标准

- [ ] `NOTICE` 写明 apex-dashboard 的固定 commit（`db9d289`），`docs/third-party/apex-dashboard.md` 有文件映射；所有源自 apex 的文件都有来源注释；`check:notices` 通过。
- [ ] 每个看板可以选择 side、stacked 或 immersive；沉浸式下小组件、分区和卡片在同一张 12 列网格中，可以拖拽移动、边角缩放、吸附、交换，重启后布局保持不变。
- [ ] 沉浸式可以完全用键盘完成移动和缩放；Esc 取消拖拽并恢复原位；reduced-motion 下没有动画；手机端回退到 side 布局。
- [ ] `HOME_WIDGETS` 可供其他模块注册小组件；内置小组件都通过注册表渲染；贡献方模块关闭时显示占位且布局不丢失；#136 的新闻小组件可以通过该机制接入。
- [ ] 旧看板打开后渲染与重构前一致；在用户编辑前文件不被改写；golden 测试通过。
- [ ] 技能按钮小组件可用：配置技能名和 prompt 模板（含变量），经确认弹窗或直发派发到 NAND 终端 agent（新会话或已有会话）；可以从库内的 `.agents/skills`、`.claude/skills`、`.codex/skills` 发现技能；agent 模块关闭时按钮显示不可用。
- [ ] 快念条和卡片可以挂技能按钮，`{path}` / `{title}` 等变量正确替换。
- [ ] 多模板、表格列显隐与排序、渐进渲染、农历纪念日、焦点调整、保存主题、全量图标、悬停删除逐项可用，旧配置自动迁移。
- [ ] 工作流分区可以按列推进：拖拽写入状态字段，并可选归档到子目录。
- [ ] 非 desktop 目录没有 Node 或 Electron 代码；eslint、`lint:css`、`test:architecture`、`check:bundle`（启动 ≤ 120 KiB）、`check:styles` 和 `pnpm test` 全部通过。
- [ ] 相关 docs 已更新。

---

## 八、非目标

- 不照搬 apex 的单体结构：单个 `renderer.ts`（4718 行）、单体 `i18n.ts`、`saveData` 存储、整份 `styles.css`。
- 不在本 issue 中实现 RSS 和新闻，由 #136 负责；本 issue 只提供小组件注册机制。
- Claudian、Copilot、Codex Desktop、ZCode 等外部 agent 适配器不是必须的，可以作为后续可选适配器。默认目标是 NAND 自己的终端 agent。
- 不引入 dnd-kit、gridstack 一类的拖拽或网格库。
- 不做按看板独立的主题（与 ADR-0020 冲突），除非另行决策。
- 不仿造 apex 中与 NAND 定位无关或依赖个人工作流的预设，例如作者个人的阶段目录命名、TickTick 集成。
- 不使用 home-pages（GPL）的任何源码。

关联：#136（新闻模块依赖本 issue 的首页小组件注册机制）。


## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
