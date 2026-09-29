---
schema_version: 1
artifact: "diagnosis"
change: "2026-09-28-issue-38-agent-preflight"
status: "root-cause-confirmed"
feedback_loop_ready: true
red_command: "node speculo/.speculo/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/run.mjs"
red_evidence: "<Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/red.log</Path>"
cleanup_status: "clean"
updated_at: "2026-09-28T06:18:46.176902+00:00"
---

# Diagnosis: #38 自动化智能体选择与运行前检查一致

## 1. 现象与影响

原始来源：<Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/source.md</Path>。本报告的 root-cause-confirmed 仅指下面已执行红灯覆盖的具体症状；合集其它条目按矩阵分类，不将局部证据外推成整 issue E2E。

| Source 子项 | 当前判定、证据与归属 |
|---|---|
| 空选择保存成 Claude Code | 3/3 动态复现；过滤对照绿。 |
| 未安装报权限模式 | 真实 start 红灯，未发生进程启动或真实文件写入。 |
| 不存在的 cwd 可保存 | 编辑器不做文件系统验证；允许运行前精准拦截，但不能为空；计划不承诺保存时验证所有运行时目录。 |
| 目录与 CLI 同时坏的优先级 | 明确：模块/智能体启用→可执行文件存在→cwd 存在且库内→权限确认→指定会话校验；都返回稳定错误标识。 |

## 2. 红灯反馈回路

- 命令：`node speculo/.speculo/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/run.mjs`；从项目根运行。
- 实际输出：<Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/red.log</Path>，另有 red-1/2/3.log；原始基线连续3次 exit=1，均为目标断言，而非构建失败。
- 精确断言与观察：真实 save 在 available=0 时保存 agentId=claude-code；仅统一默认筛选后保存数为0。start 指向合成缺失 CLI/cwd 得到 permissionRequired，cwdChecks=0，确认先后顺序。
- 耗时：见日志 elapsed_ms（组件通常约0.1–0.5秒，协议回路约数十毫秒）；复现率3/3；autonomous。
- 范围：真实生产函数/Preact组件运行，宿主和数据用合成夹具；不冒充完整 Obsidian GUI。#39 open 回调按原文提取执行，防止重写一份行为充当证明。

## 3. 最小复现

从完整 issue 排除无关账户、用户库、插件安装和真实私有历史，保留本票触发所需的最小输入。最小脚本与宿主替身在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/</Path>。

- 删除真实网络/真实账户后仍红（#37 保留 loopback 协议，外网仅下载公开资产）。
- 只保留一个记录或一个目标行为即红；#41 保留总量111来触发分页，渲染行只需1条。
- 单变量对照保留全部夹具输入，仅改变判别变量；对照绿色不等于产品已修复。
- 最后原始回路：<Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/red-3.log</Path>；源码摘要 <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/evidence/code-baseline.json</Path>。

## 4. 假设与证伪

在首轮红灯后按契约/事件遗漏、状态投影、外部数据三类候选排名并开展探针；对未复现的视觉子项不列根因假设。

| 排名 | 假设与预测 | 单变量实验 / 反证 | 结论 |
|---|---|---|---|
| 1 | 本地失败机制为下节描述；只改对应变量应改变精确断言 | PROBE_CONTROL=1 的内存构建变体；control.json 指明唯一替换；control.log exit=0 | 已确认限定症状 |
| 2 | 替代解释一 | 持久化适配器伪成功：service.save 确实收到完整 agent 动作，失败在校验前，反证。 | 排除 |
| 3 | 替代解释二 | 未设置必要名称/提示词：输入已给定且相同；仅更改候选选择，save 数变0，反证。 | 排除 |

## 5. 已确认根因

草稿默认选第一个 enabled 智能体，但下拉框还过滤 installed=false；save 仅验证 agentId 非空，不核对当前选项集合。start 在 CLI/cwd 检查前做 yolo acknowledgement，默认未确认时掩盖缺 CLI/目录；permissionRequired 使用普通 Error，又进入不可重新翻译的 message。

代码定位：
- <Path>src/view/automations/editor.ts</Path>
- <Path>src/plugin/workflows/agent-runtime.ts</Path>
- <Path>src/platform/desktop/agents/resolver.ts</Path>
- <Path>src/platform/desktop/ai-vault/canonical-cwd.ts</Path>
- <Path>src/shared/automation/errors.ts</Path>
- <Path>src/shared/i18n/automation.ts</Path>

漏检：已有测试覆盖调度/数据保护和面板组合，未覆盖本次精确输入组合与宿主可观察结果。基线 automation=23/23、contacts=20/20、panel-composition 通过，说明这些绿色不足以证明本票正确；#37 项目测试使用本地服务而未锁定公开发行资产。

## 6. 修复契约

必须改变：按 <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/spec.md</Path> 的验收合同和 <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/tickets-map.md</Path> 切片实施。必须保持：域数据权威、固定身份、生命周期、用户正文和设备/游标/投递去重合同。正确接缝已存在；不需要广泛架构重构。

OUT：不自动安装 CLI、不跳过权限确认、不访问真实智能体账户、不扩大库目录授权。

风险：本轮夹具不能证明真实宿主布局、五平台运行或已有账户功能；对应 Ticket 保留真实 E2E Gate。回滚：撤回局部修改和生成包，不删除或改写用户数据；新版本发布走前向修订，不覆盖旧 tag。

推荐下游：<Path>{roots.workflows}/specdev/S-spec/S-spec.md</Path> → <Path>{roots.workflows}/specdev/T-tickets/T-tickets.md</Path> → <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> 的 plan。

## 7. 清理与证据边界

临时变量替换只存在 esbuild 内存与随机临时目录，finally 删除 bundle；生产源码未插桩，没有遗留 DEBUG 标记。诊断脚本是可复验工件，不是上线修复，归档时由本 change owner 处理。#37 进程在 finally 终止，合成库删除；下载资产仅存临时目录，永久证据保存 URL 和 SHA256。

未运行：当前 Obsidian 完整交互、macOS/Windows 实机、真实账号/费用查询。未把历史截图或旧绿色当成当前成功。

补充运行前红灯：`PROBE_FILE=preflight.tsx node speculo/.speculo/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/run.mjs`；<Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnostics/preflight.log</Path> 记录 permissionRequired 与 cwdChecks=0。
