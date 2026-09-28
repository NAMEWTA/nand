# NAND 自动化与通知交接

## 当前任务与状态

用户先要求参考 Orca，实现统一通知、看板／档案提醒、定时创建待办，以及 Coding Agent 的定时执行和手动快捷操作；随后明确要求实施。首版实现与验证已完成。最新请求是激活 `speculo/commands/handoff.md`，未指定下一会话的新目标，本次只持久化交接。

交接时 HEAD 为 `c3a2034`（Add automation and notifications, report real PTY exit codes, and build terminal servers in CI.），实现已在该提交中。先前开发阶段“全部未提交”的描述已经过时：当前已跟踪文件没有未提交改动，只有 `speculo/.speculo/commands/handoff/` 下的报告未跟踪。本 agent 没有执行提交、推送或发布；共享工作区后来出现的提交不应被重新应用或回退。

## 从这些产物继续

路径均相对于项目根目录；详细行为和边界以现有文档与代码为准，不另起重复方案。

| 入口 | 用途 |
| --- | --- |
| `docs/automation.md` | 用户操作、时间与恢复策略、Agent 能力边界和备份说明 |
| `src/shared/automation/`、`src/shared/json-store.ts` | 公共契约、任务元数据、串行原子写入与损坏恢复 |
| `src/automation/`、`src/notifications/` | 调度、运行历史、编辑器、自动化中心、通知渠道与收件箱 |
| `src/plugin/automation-host.ts` | 产品组合、生命周期、来源注入与插件级调度 |
| `src/dashboard-view/persist/automation.ts`、`src/contacts/reminders.ts` | 源笔记定义、旧提醒迁移、重复执行防护与局部写入 |
| `src/terminal-agent/launch/automation-runtime.ts`、`src/terminal-agent/launch/automation-hooks.ts` | Agent 运行、原生 hook、会话复用、前台终端与停止 |
| `src/terminal-agent/launch/automation-catalog.ts`、`src/terminal-agent/sessions/automation-scan.ts` | CLI 参数、提示词传输、原生历史发现 |
| `processes/rust-terminal-servers/src/pty/`、`src/terminal-agent/server/pty-client.ts` | 真正退出码、初始化／输出顺序、旧服务能力识别 |
| `scripts/verify-automation.ts`、`scripts/verify-pty-automation.mjs`、`package.json` | 自动化回归、真实 Linux PTY 集成测试及命令入口 |
| `.github/workflows/terminal-build.yml`、`.github/workflows/release.yml` | 同提交构建五平台终端服务，发布使用 CI 产物 |
| `docs/third-party/orca-LICENSE.txt`、`esbuild.config.mjs` | Orca 固定版本及 MIT 归属，许可进入构建产物 |

参考来源为 [Orca 固定提交](https://github.com/stablyai/orca/tree/27b823f934f739bc85914dd717b776835f60bcf7)。实现参考其机制，但首版并非完整 Orca 功能或交互复刻。

## 后续修改应保持的约束

- 公共层承载契约，产品各自拥有数据和实现，由插件 shell 注入连接；不把所有业务平铺到 shared，也不让产品互相导入。
- 源提醒仍属于原 Markdown；独立定义、运行记录按设备持久化。同步笔记绑定执行设备，避免多设备重复运行。
- 调度依赖 Obsidian 运行，默认错过宽限为 720 分钟，只考虑最近一次。先持久化游标与运行记录再产生副作用；重启中断记录不重放，创建待办和通知分别去重。
- 保留最近 100 条已结束运行，活动记录不裁剪；运行快照和通知尝试标识避免历史裁剪导致重发。
- Agent 运行独立于 leaf；收起面板保留进程，关闭终端或停止运行结束进程。不能把输出静默当成成功，也不能因重连重放提示词。
- `src/plugin/automation-host.ts` 在 layout ready 前不扫描来源、不执行 tick。档案加载会等待布局就绪；不要恢复成在插件 onload 内等待来源扫描，否则可能死锁。

## 已完成验证

以下为实施阶段实际运行结果，本次交接没有重新运行测试：

- `pnpm run build` 通过，`main.js` 已重新生成；`pnpm run lint` 为 0 errors、197 warnings。
- `pnpm run test:automation`：18/18；`pnpm run test:terminal-agent`：179/179；`pnpm run test:contacts`：19/19。
- 设置导航、issue 回归、移动稳定性、卡片移动、备忘 Markdown、日历任务插入和编辑器评论相关检查通过。
- `cargo test --manifest-path processes/rust-terminal-servers/Cargo.toml`：22/22。
- `node scripts/verify-pty-automation.mjs`：Linux 实际服务输出、快速退出顺序、退出码 0／7、进程树取消通过。本地 Linux x64 服务二进制及校验和已更新。
- 工作流 YAML 解析和 `git diff --check` 通过。

这些检查不等于 Obsidian 真机界面验收，也不等于全部 CLI 或其它操作系统实跑通过。

## 尚待验收与范围限制

邮件和短信只有禁用入口与渠道标识，尚未连接服务商；应用内与系统通知已实现。39 个 CLI 有启动配置，17 类支持原生恢复参数，但不代表全部历史布局已支持或所有 CLI 版本已经验证。原生完成 hook 目前仅覆盖 Claude Code、Codex、Gemini、Droid，其余依赖真实进程退出或手动停止；活动期间后续定时触发会跳过。

没有云端／守护进程调度、远程执行、worktree 管理或执行设备转移 UI。原生 hook 会合并用户 CLI 配置并备份，保留 CLI 本身的登录、目录信任和 hook 授权流程；版本兼容性仍需真机验证。部分原生历史布局（例如新版 OpenCode SQLite）需要使用准确会话标识的入口。

下一会话建议先确认当前 Git 状态，按 `docs/automation.md` 在真实 Obsidian 上验收：来源笔记写回、任务完成后停止提醒、关闭看板后继续调度、重启去重、通知权限／收件箱、Agent 快捷操作／定时执行、面板收起与重新打开、明确停止。随后验证四类 hook 与原生会话恢复，以及窗口迁移、手机入口和 Windows／macOS 终端服务。跨平台 CI 已编写，本工作区未执行其远程构建。发现问题后做针对性修复与回归，将新的开发验收结果写入对应 SpecDev change 的 Evidence。

## SpecDev 状态

`speculo/.speculo/workspace.json` 将 `roots.state` 定义为 `speculo/.speculo`。本任务没有关联或新建 SpecDev change，没有本会话待恢复的外部关闭／发布操作。`speculo/.speculo/specdev/status.json` 中现存四个活动变更属于其他 issue 工作；交接时未发现 `speculo/.speculo/specdev/capture.md`。不修改其它变更状态，也不为交接补建 change。

## 建议 skills

- **dev**：继续 NAND 功能、设置、持久化、终端、测试或构建时使用；入口 `.agents/skills/dev/SKILL.md`，同时阅读其中相关架构与构建引用。
- **view-render**：修改 Preact 自动化中心、leaf 生命周期、窗口迁移或交互时使用；入口 `.agents/skills/view-render/SKILL.md`。
- **open-computer-use**：若下一会话采用该工具执行真实 Obsidian UI 验收，再读取并应用。

交接本身不授权发布、推送、向他人发消息或新增功能范围；本会话也未获得子 agent 委派指令。

开发机制与历史验证现由 <Path>{roots.state}/specdev/adr/0007-device-owned-durable-automation.md</Path>、<Path>{roots.state}/specdev/adr/0008-independent-notification-receipts.md</Path> 和 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-map.md</Path> 导航。原交接的测试结论保持原日期，不表示最新验收。
