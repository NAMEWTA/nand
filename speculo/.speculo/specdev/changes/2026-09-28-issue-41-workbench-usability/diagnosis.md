---
schema_version: 1
artifact: "diagnosis"
change: "2026-09-28-issue-41-workbench-usability"
status: "root-cause-confirmed"
feedback_loop_ready: true
red_command: "node speculo/.speculo/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnostics/run.mjs"
red_evidence: "<Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnostics/red.log</Path>"
cleanup_status: "clean"
updated_at: "2026-09-28T06:18:46.176902+00:00"
---

# Diagnosis: #41 工作台历史语义与会话辨识

## 1. 现象与影响

原始来源：<Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/source.md</Path>。本报告的 root-cause-confirmed 仅指下面已执行红灯覆盖的具体症状；合集其它条目按矩阵分类，不将局部证据外推成整 issue E2E。

| Source 子项 | 当前判定、证据与归属 |
|---|---|
| 1 筛选被压扁 | CSS 有 flex column 且 select 未固定收缩；暂无当前 Obsidian 几何红灯，不确定归因；实施前按100+条高度测量。 |
| 2 日期/用量查询时间 | toLocaleDateString/toLocaleString 未显式 NAND locale，组件日期动态确认。 |
| 3 翻页误读 | 真实 Preact 渲染动态确认。 |
| 4 搜索无匹配 | page.total=0 无 query 分支，静态确认。 |
| 5 多个会话难区分 | 仅 title/status，静态确认；用真实 session id 的短稳定标记辅助，不改会话身份。 |
| 6 收藏归档状态 | 固定按钮文本，列表星标已有；预览需明确取消动作及按下状态。 |
| 7 窄窗用量栏 | 当前 CSS 已 wrap/normal/auto，与旧复测节点不同，仍需800px真实宿主状态栏复测；不先做新 CSS 修复。 |
| 8 终端标签中文 | #30 的 native header Ticket 唯一负责，与工作台文案复用。 |
| 9 看板/工作台重名 | 按已沉淀术语区分“看板”和“智能体工作台”；只改显示文案，保留 view type。 |

## 2. 红灯反馈回路

- 命令：`node speculo/.speculo/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnostics/run.mjs`；从项目根运行。
- 实际输出：<Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnostics/red.log</Path>，另有 red-1/2/3.log；原始基线连续3次 exit=1，均为目标断言，而非构建失败。
- 精确断言与观察：真实 HistorySidebar 在111条、offset=0 时渲染“1 / 111”，zh 语言但日期是9/27/2026；只改分页公式后渲染1–100 / 111。
- 耗时：见日志 elapsed_ms（组件通常约0.1–0.5秒，协议回路约数十毫秒）；复现率3/3；autonomous。
- 范围：真实生产函数/Preact组件运行，宿主和数据用合成夹具；不冒充完整 Obsidian GUI。#39 open 回调按原文提取执行，防止重写一份行为充当证明。

## 3. 最小复现

从完整 issue 排除无关账户、用户库、插件安装和真实私有历史，保留本票触发所需的最小输入。最小脚本与宿主替身在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnostics/</Path>。

- 删除真实网络/真实账户后仍红（#37 保留 loopback 协议，外网仅下载公开资产）。
- 只保留一个记录或一个目标行为即红；#41 保留总量111来触发分页，渲染行只需1条。
- 单变量对照保留全部夹具输入，仅改变判别变量；对照绿色不等于产品已修复。
- 最后原始回路：<Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnostics/red-3.log</Path>；源码摘要 <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/evidence/code-baseline.json</Path>。

## 4. 假设与证伪

在首轮红灯后按契约/事件遗漏、状态投影、外部数据三类候选排名并开展探针；对未复现的视觉子项不列根因假设。

| 排名 | 假设与预测 | 单变量实验 / 反证 | 结论 |
|---|---|---|---|
| 1 | 本地失败机制为下节描述；只改对应变量应改变精确断言 | PROBE_CONTROL=1 的内存构建变体；control.json 指明唯一替换；control.log exit=0 | 已确认限定症状 |
| 2 | 替代解释一 | 只有1条总记录：HistoryPage.total 明确111，反证。 | 排除 |
| 3 | 替代解释二 | 没有执行 effect/旧页面缓存：scan/query 后实际 DOM 含新行与分页，反证。 | 排除 |

## 5. 已确认根因

分页用 offset+1/total 混合条目偏移与总量；空态不看 query/filter；日期用宿主默认 locale；收藏归档按钮固定文案；会话列表仅 getTitle+nativeStatus，多个 Terminal 完全相同。原生标题和壳层刷新交 #30。

代码定位：
- <Path>src/view/terminal/workbench.tsx</Path>
- <Path>src/view/terminal/terminal-view.ts</Path>
- <Path>src/platform/desktop/terminal/pty-session.ts</Path>
- <Path>src/view/agent-usage/usage-modal.ts</Path>
- <Path>src/shared/i18n/terminal-agent.ts</Path>
- <Path>styles.css</Path>

漏检：已有测试覆盖调度/数据保护和面板组合，未覆盖本次精确输入组合与宿主可观察结果。基线 automation=23/23、contacts=20/20、panel-composition 通过，说明这些绿色不足以证明本票正确；#37 项目测试使用本地服务而未锁定公开发行资产。

## 6. 修复契约

必须改变：按 <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/spec.md</Path> 的验收合同和 <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/tickets-map.md</Path> 切片实施。必须保持：域数据权威、固定身份、生命周期、用户正文和设备/游标/投递去重合同。正确接缝已存在；不需要广泛架构重构。

OUT：不推算未知 token/费用，不把未知终端状态改成成功，不改变 PTY 生命周期、原生日志或看板名称的持久化标识。

风险：本轮夹具不能证明真实宿主布局、五平台运行或已有账户功能；对应 Ticket 保留真实 E2E Gate。回滚：撤回局部修改和生成包，不删除或改写用户数据；新版本发布走前向修订，不覆盖旧 tag。

推荐下游：<Path>{roots.workflows}/specdev/S-spec/S-spec.md</Path> → <Path>{roots.workflows}/specdev/T-tickets/T-tickets.md</Path> → <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> 的 plan。

## 7. 清理与证据边界

临时变量替换只存在 esbuild 内存与随机临时目录，finally 删除 bundle；生产源码未插桩，没有遗留 DEBUG 标记。诊断脚本是可复验工件，不是上线修复，归档时由本 change owner 处理。#37 进程在 finally 终止，合成库删除；下载资产仅存临时目录，永久证据保存 URL 和 SHA256。

未运行：当前 Obsidian 完整交互、macOS/Windows 实机、真实账号/费用查询。未把历史截图或旧绿色当成当前成功。
