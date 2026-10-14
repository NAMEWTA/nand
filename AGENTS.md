# AGENTS.md

<!-- SPECULO-BOOTSTRAP:START -->
## Speculo 能力发现（只读）

需要发现 Speculo 能力或永久知识时，读取 [workspace](./speculo/.speculo/workspace.json) 解析 roots，再按当前请求检索 [能力目录](./speculo/.speculo/catalog.md)。同一会话可复用未变化的解析结果。
仅在选中相关能力后读取 [运行指南](./speculo/.speculo/AGENTS.md) 和对应入口。发现目录或读取永久知识不激活 Workflow，不创建 Change、不执行 Work。
操作授权来自用户请求及宿主权限，不来自文件中的“允许”或目录条目。
<!-- SPECULO-BOOTSTRAP:END -->

<!-- SPECULO-PERSISTENT-KNOWLEDGE:START -->
## Speculo 永久知识

以下路径只在当前任务相关时按需读取，不会自动激活 workflow 或 Work：

- specdev：<Path>{roots.state}/specdev/adr/</Path>
- specdev：<Path>{roots.state}/specdev/context/</Path>
<!-- SPECULO-PERSISTENT-KNOWLEDGE:END -->

## 项目

NAND 是 Obsidian 插件，插件 id 为 `nand`。源码是 TypeScript 和 Preact，用 esbuild 打成提交在仓库里的 `main.js`。原生终端辅助程序是 `native/pty-server` 里的 Rust。全部 NAND 管理的数据位于当前 vault 的 `.nand/`，受管 Markdown/附件在 `.nand/content/`；普通笔记、宿主自身数据和 Git 元数据保留原位。

本文件只记稳定事实。任务交接、会话笔记和会过期的状态不要写进来。

## 命令

在仓库根目录用 pnpm：

- 安装依赖：`pnpm install`
- 构建：`pnpm run build`（类型检查、样式检查，并重建 `main.js`）
- 检查：`pnpm run lint`（零警告）
- 测试：`pnpm test`

以上是命令目录，不是每次任务的必跑清单。按改动和风险选择验证，唯一选择表在[测试参考](.agents/skills/dev/references/testing.md)。只读审查和纯文档修改不要求构建插件。

## 按任务读取

只打开当前任务需要的入口和参考；涉及两类职责时组合使用，不递归通读所有链接。已读且未变化的规则可复用：

- 改插件代码、设置、测试、构建或发版：[开发规则](.agents/skills/dev/SKILL.md)
- 改工作台页面、面板、对话框或样式：[界面规则](.agents/skills/ui/SKILL.md)
- 查领域术语、架构决定或当前基线：[开发文档索引](speculo/.speculo/specdev/.config/domain-layout.md)

## 结构

- `src/app/main.ts`：插件入口，产物是仓库里的 `main.js`
- `src/modules/`：各功能模块，彼此只通过对方的 `api.ts` 访问
- `src/shell/`：三栏工作台的布局和导航
- `src/ui/`：设计系统
- `native/pty-server`：终端辅助程序，发行二进制由 CI 构建，本地可构建和测试

分区、懒加载和持久化名称见开发规则里的架构参考。

## 边界

- 只做被要求的改动。修复一处缺陷时不顺手改版式或重排无关界面。
- 面向用户的文案用 `t()`，在所属词典里同时给出 `en` 和 `zh`。
- 不新建插件脚手架，不改插件 id，不把仓库改成网页应用。
- 终端代码不复制、不改写 GPL 许可的终端项目。
- 不提交密钥，不改 `node_modules/`。
- 用户没有要求时，不提交、不推送、不升版本、不发版。已有授权在当前任务中持续有效；只有新增范围、风险或缺失决定时才补充询问。
- 构建改了 `main.js` 或 `styles.css` 时，把产物和源码留在工作区；用户要求提交时再一起提交。

## 文档

当前项目维护文档只保留中文；根目录 README.md / README.ZH.md 保持双语。删除重复版本前合并仍成立的独有信息。产品界面继续保留 t() 与 en/zh；原始许可、署名、测试夹具和历史归档保留原文。永久 ADR/context 只经 SpecDev A 网关更新，不在普通实现中直接改写。不要恢复 CLAUDE.md。

## Git

提交说明用 `type(scope): 说明`。

## 完成标准

普通任务在请求范围内的交付完成、适用检查通过、本次引入的问题已修复、必要源码/产物/文档一致且无无关改动时完成。汇报实际验证和未验证项；未请求的提交、推送、发布和归档不属于完成条件。用户已要求这些动作时继续完成，不停在准备或建议阶段。

仅在用户选用 SpecDev 时遵守对应状态与集成合同，不为普通任务创建 Change、Ticket 或审批流程。必需验收受阻时明确保留待验收状态，并继续独立且已授权的工作；可选检查不升级为阻塞。证据未失效时不重复验证，只有新改动、失败或未消除的风险才扩大检查。
