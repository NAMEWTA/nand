# T-01 实施证据（2026-09-28）

状态：本地候选已准备，未完成发布/真实宿主验收，不能标 done。

## G0 与范围

起始 HEAD：09aade655241fff439d3147a55ec1448a4f93eea，main；初始 dirty 仅用户的规划工件与 specdev/status.json，未覆盖/提交该全局状态。用户本次授权完整实施，本地提交属于票的交付。remote tags 只含 0.0.1；选择 0.0.2，不创建/推送标签。按票内 revision=2 写集实施。

## 实现与合同

- AC-001 部分成立：manifest/package/versions 同步 0.0.2；真实 BinaryDownloader 测试证明 0.0.1 缓存被拒绝、匹配版本接受、篡改失效。五个平台 URL 都来自 manifest 版本。release.yml 调用同 commit 的 reusable terminal workflow；新 gate 检查 tag/版本表、全部五平台与摘要并运行打包 Linux 二进制。
- AC-002 部分成立：真实 Linux WebSocket 回路验证 PTY 输出/退出码/时序、销毁子进程、并发 scan/query/read、原生日志摘要不变、未知用量与取消。不等于公开新 Release 默认安装，也不等于 Obsidian 导出/恢复 E2E。
- 未增加旧服务协议协商。README 和 changelog 明确候选尚未发布。

## 命令与原始记录

所有日志在 `implementation/`，没有 PROBE_CONTROL。

| 命令 | exit / 结果 | 日志 |
|---|---|---|
| diagnostics/run.mjs（重新下载公开 0.0.1、核验固定 SHA256） | 1，agent_data 被错误路由为 PTY PARSE_ERROR | public-0.0.1-red.log |
| Node binary-downloader.test.ts（修改版本前） | 1，版本与升级断言红灯 | candidate-red.log |
| 同一 Node 测试（修改版本后） | 0，6/6 | candidate-green.log |
| cargo test --locked --manifest-path processes/rust-terminal-servers/Cargo.toml | 0，29/29 | cargo-test.log |
| TERMINAL_SERVER_VERSION=0.0.2 cargo build --locked --release --manifest-path processes/rust-terminal-servers/Cargo.toml | 0 | cargo-build.log |
| node scripts/verify-pty-automation.mjs | 0 | pty-integration.log |
| pnpm test:terminal-agent | 0，189/189 | terminal-tests.log |
| pnpm run build | 0，重建 main.js 与原字节一致（本票不改生产 TS） | build.log |
| pnpm run lint | 0，0 errors / 157 既有 warnings；未修改受 lint 的生产源码 | lint.log |
| git diff --check | 0 | 当前工具输出 |

## Skill Execution Records

dev SHA256=f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7 与绑定相符。已读取 architecture / obsidian-api / build-and-release / skill-maintenance，并执行本地 version/release 路径、构建、lint、terminal/Rust 验证规则；build-and-release 所属发布说明随 workflow 同步。无结构或叶子变更，view-render 不适用。

## 未闭合验收

本机没有正在运行的 Obsidian；没有声称 GUI 已通过。四个非 Linux x64 平台没有本地构建/实测。未推送、发布、改写 issue。发行候选本地 zip 与 Linux service 摘要在 implementation/local-artifacts.json；最终发布必须锁定最终提交并由 release.yml 构建，不能把当前本地文件冒充公开资产。后续具备具体候选和发布授权后跑五平台 CI，从公开 Release 重新下载，执行 AC-002 的首次启动/历史/用量/导出/恢复/重启/启停/进程清理完整 E2E。

## 本地集成

implementation/result SHA：e7c59b2e87a858725874d53530bdacb72918f5ca；其唯一 parent 为 09aade655241fff439d3147a55ec1448a4f93eea，direct-parent 已由 git rev-parse HEAD^ HEAD 验证。非空 10 文件提交；证据/规划尚留工作区以便后续汇总提交。
