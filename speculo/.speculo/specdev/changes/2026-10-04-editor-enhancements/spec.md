# 编辑器增强：实施中的附件核心

## 状态与范围

本变更是用户批准的《NAND 编辑器增强完整实施计划》的阶段性实现，**不是四个领域的完整交付，不具备按完整方案合并的条件**。目标基线为 `NAMEWTA/nand@3c44be3de7c7d7f8220be39fa3ab30853541933a`。计划附件的 SHA-256 为 `9b4109ea2d6a1c783570cbcb035044f5904f83d6185a8c25fa685c0752a6abaf`，来源与上游固定提交见 [来源锁](source-lock.json)。

本次仅增加与宿主无关的附件领域核心、测试入口及开发进度记录。附件、输入增强、非 AI 工具栏、格式规范仍是总范围；AI 写作不在范围中。现有终端 Agent、同步占位、评论存储格式、视图标识和最低宿主版本均不修改。

## 已实现的代码范围

| 文件 | 当前能力 | 尚未包含 |
|---|---|---|
| `src/core/attachments/model.ts` | 路径策略、文件端口、逐项结果及错误契约 | Obsidian 宿主和持久化 |
| `src/core/attachments/path-policy.ts` | 笔记旁 `assets`、三种模板、单项／文档／最近目录覆盖、Vault 内路径 | 配置编辑界面、实际目录选择 |
| `src/core/attachments/naming.ts` | 捕获时间的本地 24 小时秒级前缀、可选名称、扩展名、UTF-8 长度和冲突序号 | 真实剪贴板的文件类型识别 |
| `src/core/attachments/import-service.ts` | 单实例串行批次、非覆盖写入端口、逐项错误、协作取消与停止 | 原生文件 IO、粘贴／拖入事件、链接插入 |
| `src/core/attachments/markdown-link.ts` | 来源笔记相对路径与标准 Markdown 转义 | 原生链接解析验证、Wiki 链接适配 |
| `src/core/attachments/organization.ts` | 基于完整引用快照的单文件保留／复制／移动决策 | 引用索引、搬移／删除／重命名操作、整理面板 |

`core` 不引入 Obsidian、CodeMirror、DOM 或 Node 文件系统；不添加依赖，不改变现有运行时入口。原生 `createNewBinary` 端口实现必须保证不覆盖，并且只有确认的路径冲突才能返回 `exists`。单元测试使用内存端口，**不构成对真实文件系统原子性的验证**。

## 可复现检查

通过现有测试入口运行：

```sh
pnpm run test:editor-attachments
```

该入口由现有 `test:all` 自动发现，没有改动 CI 工作流或放宽检查。无 pnpm 的独立检查环境实际运行了同一条 Node 命令：

```sh
node --experimental-strip-types --import ./scripts/register-ts-hooks.mjs --test src/core/attachments/attachments.test.ts
```

本轮本地证据：Node 22.16.0、TypeScript 5.8.3；56 项独立用例，在 `UTC`、`America/New_York`、`Asia/Shanghai` 下各运行一次，均为 56 通过、0 失败、0 跳过。三个时区是同一套测试的三次运行，不是 168 个不同用例。六个生产核心文件通过独立严格 TypeScript 检查。详细命令、范围和代码摘要见 [验证记录](verification.md)。

这些结果**不代表**已执行整个 NAND 的 `build`、`lint`、`test:all`、架构检查，也不代表 Obsidian 1.12、手机、IME、真实剪贴板、多窗口或新增功能的端到端验收。当前容器没有完整仓库依赖；GitHub 上的实际 CI 结论应以对应 PR 提交的运行记录为准，不能用这份记录替代。

## 明确未完成的工作

[任务状态表](tasks.md)保留原计划 52 个任务的标识、内容、前置和验收条件。路径、命名、导入服务与链接核心对应 A01、A02、A05、A06、A07 的部分代码，不标记整个任务或 M2 完成。

编辑器宿主解耦、四个 `EditorDomain`、设置封套、配置归一化、双设置渲染路径、I18N、粘贴认领、命名 Modal、原编辑器事务、Vault IO、Wiki 链接和附件整理均未接线。Easy Typing、非 AI Editing Toolbar、Linter 的代码迁移和完整上游样例也尚未完成。

## 下一步接线约束

先完成 B02–B05 与 H01–H05 的真实验证，再接入原生文件端口和附件 UI。不要为了使本分支看似可用而添加空 `EditorDomain`、默认假成功、运行时下载上游代码、绕过 `main.js` 一致性检查或整篇正文覆盖。

未来原生适配必须在事件发生时捕获文件、编辑器和落点，在异步导入后校验来源；实际文件写入与编辑器链接插入是两个操作。文件已写入但链接插入失败时，应保留可找回的文件并报告。不得把取消或普通撤销等同于无条件删除文件。

## 合并出口

本变更保持草稿状态。用户要求的完整方案仍需逐项闭合；整库测试、构建与产物一致性、现有领域回归及隔离 Vault 实机验证完成后，才能将对应实现作为完整增强合入最新 `main`。不创建发布标签，不将当前核心代码标为已安装可用。
