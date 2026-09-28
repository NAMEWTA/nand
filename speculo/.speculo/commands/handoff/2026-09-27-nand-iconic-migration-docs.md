# NAND 图标迁移与文档交接

日期：2026-09-27。范围：本对话的 Issue #14 图标迁移、配套文档完善。用户最后要求执行 `speculo/commands/handoff.md`，未指定下一会话的新功能目标。

## 当前状态

用户依次要求规划、实施 Iconic 仿照迁移，再优化对应文档；这些本地工作已完成。当前没有正在执行的实现任务，也没有等待用户回答的问题。

交接时重新检查 Git：

- 分支 `main`，HEAD 为 `c3a2034`（自动化、通知、PTY 退出码与终端构建相关变更）。这些后续变更不是本对话的图标工作，不要将其归为本轮实现或验证。
- 图标实现及文档已包含在 `5af05c6`：`Add the contacts and icon modules, raise the Obsidian floor to 1.12, and fix issues #23–#25.` 此提交还包含其他并行任务，不能整体撤销或将全部内容视为图标改动。
- 写本报告前 `git status --porcelain=v1` 为空。此前实现阶段的“大量未提交改动”状态已经过时；后续应以现场 Git 状态为准。
- 本对话没有创建发布、推送代码、关闭远程 Issue 或发送 Issue 评论。当前远程 Issue 状态没有在交接时重新查询。

## 先读的已有产物

以下路径均相对于项目根目录，不相对于本报告：

| 需要了解 | 权威入口 |
|---|---|
| 用户操作、默认配置、规则、备份恢复与常见问题 | `docs/icons.md` |
| 固定上游版本、迁移边界、宿主适配、验证矩阵与已知差异 | `<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path>` |
| 桌面实测截图 | `<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic/</Path>` |
| 产品领域与文档入口 | `README.md` |
| 待发布变更 | `CHANGELOG.md` 的“未发布”段落 |
| 领域边界、生命周期、设置页、持久化命名 | `.agents/skills/dev/references/architecture.md` |
| API、CSS 与私有 API 类型适配规范 | `.agents/skills/dev/references/obsidian-api.md` |
| 构建、测试、许可证分发及发布规则 | `.agents/skills/dev/references/build-and-release.md` |
| 上游测试基线及生成来源 | `scripts/fixtures/iconic/README.md`、`scripts/fixtures/iconic/upstream-1.1.10.json` |
| 历史 Issue 状态快照的修正注记 | `<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-review-2026-09-27.md</Path>` |

远程需求：https://github.com/NAMEWTA/nand/issues/14 。上游固定版本和提交链接见 `<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path>`，不要依据上游主分支重做迁移。

## 保持的用户意图

用户强调复用成熟逻辑、遵守当前目录和持久化规范，并将功能作为全能插件中的独立垂直领域。已接受的具体约定记录在上述架构和迁移文档中；后续不要无任务依据重写规则算法、合并到看板图标选择器、引入独立 Plugin 实例或增加历史数据导入流程。

代码入口为 `src/iconic/index.ts`，领域实现位于 `src/iconic/`；壳层接入位于 `src/plugin/main.ts`、`src/plugin/module-lifecycle.ts` 和 `src/plugin/settings/`。中英文文案位于 `src/shared/i18n/iconic.ts`。持久化必须继续由领域 store 管理，尤其避免声明式设置的 `control.key` 意外把图标偏好绑定到 NAND 主设置。资源完整许可证由 `src/iconic/res/NOTICE.txt` 经 `esbuild.config.mjs` 放入根目录 `main.js`。

## 验证证据的范围

历史执行结果记录在 `<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path>`，此处只记录交接需要的时间边界：

- 实现阶段：构建、lint 和对应回归通过；`test:iconic-port` 的 8 项测试包含 137 条固定上游规则输出；另运行了设置导航、编辑器评论、Issue 回归、路径选择器测试。
- 桌面阶段：隔离库中实测 Obsidian 1.12.4 和 1.13.7，覆盖选择器保存、规则、声明式/旧版设置、独立存储、外部修改重载、反复启停及卸载清理。截图已保存在项目中，不依赖临时测试进程继续运行。
- 最后的文档更新阶段：本地文档链接、脚本引用、22 项设置数量检查通过；再次执行 build 和 lint，结果为零错误、197 条既有警告；该阶段没有修改业务代码。
- **这些不是对当前 HEAD `c3a2034` 的新一轮全量验证。** 本次 handoff 仅检查仓库和产物状态，没有重跑测试。

## 后续可接续事项

目前没有本轮任务必须完成的剩余实现。用户若要求继续验收，优先核对 `<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path>` 中仍未覆盖的 Android/iOS 真机、精确的 1.12.0 客户端、第三方主题及快速切换插件组合。已有桌面证据不可替代这些场景。

保留的上游差异及外部规则缓存刷新限制已有文档说明；如用户要求修正，应作为明确的后续行为变更，更新相应测试，不能悄悄改写上游对照基线。若需要提交、推送、发布或远程 Issue 操作，应先结合用户新指令确定范围；本 handoff 不是这些操作的授权。

后续修改代码前先检查 Git 差异与当前实现，按 `.agents/skills/dev/references/build-and-release.md` 选择验证；继续图标维护时至少关注 `test:iconic-port`，涉及壳层设置时增加 `test:settings-nav`。不要因交接而重新执行已经完成的迁移。

## SpecDev 状态

状态根由 `speculo/.speculo/workspace.json` 的 `path_base: project-root` 和 `roots.state: speculo/.speculo` 解析。本对话没有建立图标迁移的 SpecDev change；检查 `speculo/.speculo/specdev/status.json` 和现有 changes 后，未发现属于此交接范围的图标 change。不要为补交接而创建 change 或修改其他任务的账本。

本范围没有 `pending-close`、`close-failed`、`pending`/`publish-failed` 发布账本或 capture 失败行需要恢复；交接时 `speculo/.speculo/specdev/capture.md` 不存在。现有其他 SpecDev change 不属于此任务。

## 建议 skills

- `dev`：继续 NAND 图标、壳层、设置、文档规范或构建维护时使用；入口 `.agents/skills/dev/SKILL.md`。
- `view-render`：仅当后续任务涉及 Obsidian leaf 中的新视图或渲染调整时使用；入口 `.agents/skills/view-render/SKILL.md`。当前图标模块主要使用原生设置、菜单和 Modal，不因交接而重构渲染。

遵守当前会话的工具与授权规则；本交接不要求启动子 agent。
