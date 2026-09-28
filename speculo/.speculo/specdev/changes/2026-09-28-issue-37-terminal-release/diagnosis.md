---
schema_version: 1
artifact: "diagnosis"
change: "2026-09-28-issue-37-terminal-release"
status: "root-cause-confirmed"
feedback_loop_ready: true
red_command: "node speculo/.speculo/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/run.mjs"
red_evidence: "<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/red.log</Path>"
cleanup_status: "clean"
updated_at: "2026-09-28T06:18:46.176902+00:00"
---

# Diagnosis: #37 发布与插件匹配的终端服务

## 1. 现象与影响

原始来源：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/source.md</Path>。本报告的 root-cause-confirmed 仅指下面已执行红灯覆盖的具体症状；合集其它条目按矩阵分类，不将局部证据外推成整 issue E2E。

| Source 子项 | 当前判定、证据与归属 |
|---|---|
| 协议不匹配 | 真实 Release 资产协议回路确认，SHA256 b28fa7ee45c72f1a1740840839ec0a52fb455694e598afe7512a0bcc7c75def1。 |
| 默认下载仍旧版 | 远程 release metadata 与 manifest 版本均为 0.0.1，当前事实确认。 |
| 首次叶子失败/第二次成功/孤儿 shell | 原报告证据强，本轮仅复现跨模块错误机制；必须在新 Release 的干净默认安装 E2E 验收，不能用本地构建替代。 |
| 五个平台 | 当前只跑 Linux x64；另四个平台需发布资产和 CI/平台验证，不声称均实测通过。 |
| 旧服务兼容建议 | 已被最新评论明确否决，不进入计划。 |

## 2. 红灯反馈回路

- 命令：`node speculo/.speculo/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/run.mjs`；从项目根运行。
- 实际输出：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/red.log</Path>，另有 red-1/2/3.log；原始基线连续3次 exit=1，均为目标断言，而非构建失败。
- 精确断言与观察：校验 Release Linux x64 SHA256 后发送相同 agent_data+pty 消息：旧资产返回 pty/PARSE_ERROR unknown variant agent_data；cargo build --locked --release 当前服务返回 agent_data result 和 PTY init_complete/exit。旧资产 3/3 红；当前源码对照绿。
- 耗时：见日志 elapsed_ms（组件通常约0.1–0.5秒，协议回路约数十毫秒）；复现率3/3；autonomous。
- 范围：真实生产函数/Preact组件运行，宿主和数据用合成夹具；不冒充完整 Obsidian GUI。#39 open 回调按原文提取执行，防止重写一份行为充当证明。

## 3. 最小复现

从完整 issue 排除无关账户、用户库、插件安装和真实私有历史，保留本票触发所需的最小输入。最小脚本与宿主替身在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/</Path>。

- 删除真实网络/真实账户后仍红（#37 保留 loopback 协议，外网仅下载公开资产）。
- 只保留一个记录或一个目标行为即红；#41 保留总量111来触发分页，渲染行只需1条。
- 单变量对照保留全部夹具输入，仅改变判别变量；对照绿色不等于产品已修复。
- 最后原始回路：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnostics/red-3.log</Path>；源码摘要 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/code-baseline.json</Path>。

## 4. 假设与证伪

在首轮红灯后按契约/事件遗漏、状态投影、外部数据三类候选排名并开展探针；对未复现的视觉子项不列根因假设。

| 排名 | 假设与预测 | 单变量实验 / 反证 | 结论 |
|---|---|---|---|
| 1 | 本地失败机制为下节描述；只改对应变量应改变精确断言 | 替换为当前源码编译服务；current-binary.log exit=0 | 已确认限定症状 |
| 2 | 替代解释一 | 本地网络/CLI 未安装：同一 loopback WS 有 PTY init_complete，缺陷出现于协议解析，反证。 | 排除 |
| 3 | 替代解释二 | 历史文件缺失：roots=[] 仍旧资产报模块未知；同请求当前源码服务成功，反证。 | 排除 |

## 5. 已确认根因

公开最新 Release 仍为 0.0.1，二进制路由仅识别 pty；当前客户端会发 agent_data，旧服务将其解析失败投影为 pty/PARSE_ERROR。并行 PTY 初始化会遇到非自身模块的错误；当前源码服务能够返回对应 requestId 的历史结果。manifest 仍 0.0.1，版本相等检测不能选择尚未发布的新服务。

代码定位：
- <Path>src/platform/terminal-server/binary-downloader.ts</Path>
- <Path>src/platform/terminal-server/binary-download-urls.ts</Path>
- <Path>src/platform/terminal-server/server-manager.ts</Path>
- <Path>src/platform/terminal-server/pty-client.ts</Path>
- <Path>processes/rust-terminal-servers/src/router.rs</Path>
- <Path>.github/workflows/release.yml</Path>
- <Path>manifest.json</Path>
- <Path>package.json</Path>
- <Path>versions.json</Path>

漏检：已有测试覆盖调度/数据保护和面板组合，未覆盖本次精确输入组合与宿主可观察结果。基线 automation=23/23、contacts=20/20、panel-composition 通过，说明这些绿色不足以证明本票正确；#37 项目测试使用本地服务而未锁定公开发行资产。

## 6. 修复契约

必须改变：按 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/spec.md</Path> 的验收合同和 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/tickets-map.md</Path> 切片实施。必须保持：域数据权威、固定身份、生命周期、用户正文和设备/游标/投递去重合同。正确接缝已存在；不需要广泛架构重构。

OUT：遵循源 issue 最终决定：不加旧服务兼容/版本协商。此次不发布 release，不关闭 issue。原报告完整首次打开 UI 和孤儿 shell 未在本轮 Obsidian 实测。

风险：本轮夹具不能证明真实宿主布局、五平台运行或已有账户功能；对应 Ticket 保留真实 E2E Gate。回滚：撤回局部修改和生成包，不删除或改写用户数据；新版本发布走前向修订，不覆盖旧 tag。

推荐下游：<Path>{roots.workflows}/specdev/S-spec/S-spec.md</Path> → <Path>{roots.workflows}/specdev/T-tickets/T-tickets.md</Path> → <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> 的 plan。

## 7. 清理与证据边界

临时变量替换只存在 esbuild 内存与随机临时目录，finally 删除 bundle；生产源码未插桩，没有遗留 DEBUG 标记。诊断脚本是可复验工件，不是上线修复，归档时由本 change owner 处理。#37 进程在 finally 终止，合成库删除；下载资产仅存临时目录，永久证据保存 URL 和 SHA256。

未运行：当前 Obsidian 完整交互、macOS/Windows 实机、真实账号/费用查询。未把历史截图或旧绿色当成当前成功。

下载与校验：从 https://github.com/NAMEWTA/nand/releases/download/0.0.1/rust-terminal-servers-linux-x64 等 release metadata 选择 linux-x64 二进制（实际 URL 见 release-metadata.json），使用 sha256sum 与同名 .sha256 比较后执行。不得执行未核对摘要的替代二进制。
