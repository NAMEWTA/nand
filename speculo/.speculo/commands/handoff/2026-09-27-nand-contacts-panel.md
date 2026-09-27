# NAND 档案面板交接

## 范围与当前状态

用户最后要求激活 `speculo/commands/handoff.md`，未指定下一会话的新目标。本报告交接此前的档案功能实现与文档完善工作；这两项已完成，下一步优先是真实 Obsidian 验收，不能据此自行扩展新功能或发布版本。

用户的核心要求：以独立可视化档案面板管理联系人和关联企业；Markdown 是可携带、可供 AI 阅读的持久化来源，日常操作在面板完成。不要将功能并入看板，也不要把原始 Markdown 编辑器当作主要交互。

## 从这些产物继续

所有路径均相对于项目根目录。

| 产物 | 用途 |
| --- | --- |
| `docs/contacts.md` | 用户操作、筛选语义、关系方向、目录切换、备份恢复及冲突处理；不在交接中重复正文 |
| `src/contacts/persist/format-guide.md` | 随插件分发的字段与 Markdown 格式协议 |
| `docs/contacts-development.md` | 实现入口、数据流程、测试命令、验证记录与尚未完成的实机清单 |
| `.agents/skills/dev/references/architecture.md` | 产品边界、持久化所有权、设置与生命周期约定 |
| `.agents/skills/dev/references/build-and-release.md` | 构建、回归检查及发布规则 |
| `README.md`、`CHANGELOG.md` | 对外入口与变更摘要 |
| `src/contacts/`、`src/plugin/settings/contacts-settings.ts`、`src/shared/contacts-settings.ts`、`src/shared/i18n/contacts.ts` | 功能、设置与文案；具体文件导航见开发说明 |
| `scripts/verify-contacts.ts`、`package.json` | 档案回归测试与实际命令定义 |

## Git 与并行工作

交接读取时，HEAD 为 `c3a2034`（自动化、通知、PTY 和终端服务器 CI），工作区 `git status --porcelain` 为空。档案与图标等变更已包含在 `5af05c6`。这与先前开发时大量未提交变更的状态不同，后续不要按旧上下文重新应用补丁。

本对话没有执行提交、推送或发布。上述提交是在共享工作区后续出现的事实，不代表本 agent 对后续功能做过验证。仓库同期有图标、编辑器评论、终端等其他工作；继续前重新检查 diff，保留其他人的修改。不要回退最低 Obsidian 版本或覆盖其他领域文档。

## 验证状态与限制

长期验证记录及清单见 `docs/contacts-development.md`。文档完善阶段再次通过档案测试 19/19、生产构建、lint（0 errors、197 warnings），并检查了 34 个本地文档链接、格式说明表格能被解析、说明文件不会被误识别为档案，以及重建后的 `main.js` 包含新版说明。

这些结果对应当时工作区，不是对当前 HEAD 所有后续提交的重新验证。临时 DOM 冒烟检查不属于已提交的长期测试入口；不要依赖临时文件继续工作。真实 Obsidian 桌面、弹出窗口和手机验收仍未完成，不可将共享／看板的移动稳定性脚本通过写成档案真机验收通过。

## 下一会话建议

1. 先阅读 `docs/contacts-development.md` 与相关 skills，确认当前分支和工作区，再执行其中的实机验收清单。
2. 优先检查卡片／详情导航、手机菜单、窗口迁移、双窗口编辑冲突、目录切换及停用后的文件可读性；记录应用版本、平台和实际结果。
3. 如发现问题，按复现场景修复并运行对应回归检查。没有行为变化时不必重写测试；修改运行时格式说明后需要重建 `main.js`。
4. 把验证结果补回已有开发说明，避免另起一份重复的功能方案。CSV／Excel 导入、通讯录同步、关系图和提醒不属于已实现范围，新增这些功能需要后续任务明确范围。

两个容易遗漏的维护细节：格式说明在用户目录中仅缺失时创建，升级不覆盖旧说明；说明中的 YAML 范例不能让整份说明被解析器初筛成档案。具体规则见 `docs/contacts-development.md`，以代码和格式协议为准。

## SpecDev 状态

状态根由 `speculo/.speculo/workspace.json` 的 `roots.state` 解析为 `speculo/.speculo`。已查看 `speculo/.speculo/specdev/status.json`：现有活动变更为其他 issue 工作，本次档案任务未关联 SpecDev change，也没有在本会话创建 change 或 inbox 记事项。因此本交接无待恢复的 triage 关闭／发布操作，不改动其他 change 的状态或授权。

## 建议 skills

- **dev**：继续 NAND 源码、设置、持久化、文档规范或构建检查时使用；项目入口为 `.agents/skills/dev/SKILL.md`。
- **view-render**：修改档案 Preact 视图、leaf 生命周期、窗口迁移或视觉交互时使用；入口为 `.agents/skills/view-render/SKILL.md`。
- **open-computer-use**：若后续使用其工具完成真实 Obsidian 界面操作，再读取并应用该 skill。

本会话没有获得额外的子 agent 委派指令，也没有新的对外发送、发布或删除资料授权。交接报告本身只持久化上下文，不触发这些操作。
