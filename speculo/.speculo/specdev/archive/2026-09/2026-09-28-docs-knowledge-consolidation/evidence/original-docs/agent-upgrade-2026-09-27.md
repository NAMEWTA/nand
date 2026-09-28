# 2026-09-27 智能体工作台与 issue 修复实施记录

本次在审阅四份 handoff、未关闭 issues 和当前源码后实施：修复保存与持久化阻塞，统一终端工作台，补齐六种智能体的原生历史、生命周期及用量，改善档案、设置和通知。项目尚未发布，直接采用新数据结构和命名，没有添加历史命名迁移或兼容别名。原有 `speculo` 归档整理不属于本次修改。

## Issue 对照

| Issue | 核实与实施结果 |
|---|---|
| #14 | Iconic 已完成迁移，保留固定上游行为 oracle；本次仅做经过审阅的文案、命令命名与内联标题修复 |
| #26 | 档案保存 Promise 回调返回 Obsidian Button thenable 会造成微任务循环；改为返回 void，并加入类型感知 lint 规则 |
| #27 | 1.13 设置 chrome 顺序及 Iconic 普通设置行隐藏选择器确有遗漏，已修复；保留 1.12 fallback |
| #28 | `show-inline-title` 与模块开关均在 body，原后代选择器错误；改为同元素条件 |
| #29 | 延迟 leaf 不能仅凭 view type 当作 TerminalView，改为加载后检查真实实例 |
| #30 | 功能区 ID 从显示语言解耦；切换语言更新标题和已注册命令名称 |
| #31 | 修复筛选现任／曾任人员、类型专属属性、语言切换表头、同名选择器及失效选中状态；显示名称修改不重命名文件 |
| #32 | 用户入口集中为六种核心智能体；Windows 专属命令限制平台，PowerShell 要求检测到 pwsh；补全文案与功能入口 |
| #33 | 偶发图标加载问题没有稳定复现，未宣称找到或修复根因；继续保留上游生命周期、恢复及桌面回归覆盖 |
| #34 | Obsidian adapter.rename 不能假定覆盖已有目标；JSON 写入改为串行备份后写主文件，失败不推进已发布状态；加载失败仍注册自动化页并显示重试 |
| #35 | 异步待办目标选择回调不再返回 Setting thenable；代次检查阻止已关闭／重绘表单被旧结果修改 |
| #36 | 细化校验与错误码；保存保留列表位置，删除保留运行快照；补齐来源跳转、收件箱已读／清理、未读数、独立投递回执及历史清理 |

#33 的判断是证据边界，不是关闭建议。本次没有修改 GitHub issue 状态。

## 核心实现

- **工作台**：Preact 会话栏、当前库历史、额度／用量区域，保留 xterm。关闭 leaf 保留进程，关闭会话停止进程，停用模块清理全部进程。多分栏引用同一会话时先解除绑定再关闭。
- **历史**：Rust 后台解析六种原生格式；OpenCode SQLite 只读；规范化目录后限定当前库。支持完整正文、元数据搜索、分页、恢复、标题、标签、收藏、归档与 Markdown 导出。NAND 元数据独立于原生日志。
- **自动化**：先持久化运行及游标，再执行外部动作；取消后不被迟到的完成覆盖；重启标记中断且不重放提示词。删除定义后仍能查看运行快照。
- **完成事件**：Pi 使用原生 idle/settled，OpenCode 过滤子会话／可恢复错误，Grok 写入官方独立 hooks 文件。每个终端有私有事件目录，扩展在非 NAND 环境下不发事件。
- **用量**：账户凭据与启动账户一致；Claude macOS 使用配置目录作用域钥匙串；Gemini 保留模型额度；显示上次检查时间和过期结果。原生 token 与订阅额度分开，缺少 token 或费用时明确未知。
- **通知**：投递前先保留回执。清理收件箱或运行历史不会清掉去重依据；崩溃后的不确定投递不自动重复发送。

详细操作与存储路径见[工作台说明](agent-workbench.md)和[自动化说明](automation.md)。

## 参考实现

实际阅读并对照 [Orca 固定提交 `27b823f`](https://github.com/stablyai/orca/tree/27b823f934f739bc85914dd717b776835f60bcf7) 的实现，而非只根据 README 设计：

- `src/main/ai-vault/session-scanner-primary-parsers.ts`、`session-scanner-gemini-parsers.ts`、`session-scanner-grok-parser.ts`、`session-scanner-opencode-sqlite-*`：原生记录、目录归属及 SQLite。
- `agent-status-handler-source.ts`、`status-plugin-lifecycle-source.ts`：Pi/OpenCode 原生完成与子会话过滤。
- `grok-hook-config.ts`、`grok-hook-service.ts`：独立 hook 配置。
- 原生额度读取、侧栏、快速启动及自动化完成监视实现：账户作用域、模型窗口与进程生命周期。

另对照 [Gemini Storage](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/config/storage.ts) 和 [ProjectRegistry](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/config/projectRegistry.ts) 的真实格式。上游许可见 `docs/third-party/orca-LICENSE.txt`；Iconic 固定 oracle 保持原样，NAND 术语覆盖在测试中显式列出。

## 验证

生产构建通过；lint 为 0 errors、186 warnings（修改前 197 warnings）。测试不能代替真实提供方认证与系统权限验收。

- 自动化 23 项、档案 20 项、Iconic 8 项（包含固定上游样本）、终端 181 项、设置导航与共享移动交互回归。
- `test:promise-callbacks` 对真实 Obsidian 类型验证：Promise 回调返回 Button/Setting 会报错，void 回调允许。该脚本需与全仓 lint 顺序执行，避免临时文件清理竞争。
- Rust 29 项：完整长日志、追加、路径范围、账户身份、OpenCode 只读数据库、Gemini JSONL、Grok 正文文件更新、元数据分页筛选、累计用量去重及未知费用。
- Linux release 服务真实 WebSocket/PTY 联测：快速退出、0/非 0 退出码、进程树停止、历史扫描期间 PTY 响应、查询、取消。
- Linux Obsidian 1.13.7 隔离库：档案保存后继续响应、异步待办选择器、连续保存两次并运行通知、关闭／重开工作台接回同一进程、单独结束最后一个会话后重新新建、原生历史索引／标签搜索／Markdown 导出、隔离目录原生 Pi hook 安装、原生状态更新即时刷新会话栏、停用终端后进程清空、语言切换保留功能区 ID，以及 1.13 设置页产品隔离。另在 Obsidian 1.12.4 检查 fallback 设置导航、档案设置和工作台启动。测试环境碰到宿主 inotify 配额，临时测试进程替换文件 watcher；没有修改产品代码或系统限制，因此不将这些检查视为文件监视验收。

尚未覆盖：六种 CLI 的真实认证端到端流程、实际订阅额度响应、macOS 钥匙串、Windows、手机真机及全部浮窗交互。索引按文件修改信息跳过未变日志，已变日志重新完整解析；不宣称已实现按字节增量索引。原生日志落盘晚于完成事件时，本次自动化用量可能暂缺。
