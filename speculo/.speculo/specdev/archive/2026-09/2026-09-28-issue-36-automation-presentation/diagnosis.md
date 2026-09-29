---
schema_version: 1
artifact: "diagnosis"
change: "2026-09-28-issue-36-automation-presentation"
status: "root-cause-confirmed"
feedback_loop_ready: true
red_command: "node speculo/.speculo/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnostics/run.mjs"
red_evidence: "<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnostics/red.log</Path>"
cleanup_status: "clean"
updated_at: "2026-09-28T06:18:46.176902+00:00"
---

# Diagnosis: #36 自动化状态与通知呈现准确可读

## 1. 现象与影响

原始来源：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/source.md</Path>。本报告的 root-cause-confirmed 仅指下面已执行红灯覆盖的具体症状；合集其它条目按矩阵分类，不将局部证据外推成整 issue E2E。

| Source 子项 | 当前判定、证据与归属 |
|---|---|
| 1.1/1.2 规则、字段校验 | 最新复测已通过；automation 23 个测试通过，回归。 |
| 1.3 CLI/目录错误与空下拉框 | #38 唯一修复归属，本文只交叉引用。 |
| 1.4 旧失败语言混杂 | 普通 Error 和投递字符串路径仍存在；已带 errorCode 的运行能动态翻译，不能宣称完全没有结构化支持。 |
| 1.5 半角冒号、3.2 自动化日期 | 组件/通知拼接仍硬编码，代码确认；系统通知已发送文本不能追溯改写。 |
| 2.1 删除确认/历史、2.2 过去时间、2.3 选中顺序 | 最新复测已通过，保留回归。 |
| 2.4 来源打开 | 待办/档案已改善；widget 残留交 #39。 |
| 2.5 重复标题正文 | 来源默认 title/body 相同且通知两处输出，需去重显示而非修改原任务文本。 |
| 3.1 换行、3.3 全读清理/空态/未读数、3.4 隐藏已读按钮 | 新 InboxPanel 已实现，保留回归；不可把清理已读扩大成清理未读。 |
| 4.1 两个全部、搜索控件 | 新增 aria-label 可供辅助技术读取，但可见标签仍缺；两个概念需可见区分。 |
| 4.2 长列表滚动、4.3 提示词 pre | 源码仍是整页 grid 与 pre；具体主题几何效果未做 Obsidian 实测，布局票先验证。 |
| 4.4 编辑器标题/缩进/空白 | 新建编辑标题仍同 automation.title；缩进/宽限对齐属待几何复测。 |
| 4.5 无动词命令 | 命令 nameKey 使用页面标题，代码确认，分离命令键。 |
| 5.1 设置错位、5.3 多标签换行 | 导航已有重构；宽度换行本身不是缺陷，须确保可达而不强制单行。 |
| 5.2 说明伪装设置 | channels/sessionMode 只有说明，没有承诺全局默认值；将说明明确为帮助并去掉重复标题，不凭空加控件。 |
| 5.4 自动化开关 | 用户已选定新增开关：关闭停止自动/手动执行，保留数据和通知历史；T-05，属于明确 feature，不伪装为已复现 bug。 |
| 清理历史后一次性显示待执行 | 动态确认显示错误，游标保留；必须补 tick 不重跑的联合回归。 |

## 2. 红灯反馈回路

- 命令：`node speculo/.speculo/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnostics/run.mjs`；从项目根运行。
- 实际输出：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnostics/red.log</Path>，另有 red-1/2/3.log；原始基线连续3次 exit=1，均为目标断言，而非构建失败。
- 精确断言与观察：给真实 AutomationsPanel 输入 runs=[] 且 cursors[once:1]=1000，仍显示“待执行”；只改变 fallback 对 cursor 的读取即可去掉该误报。实验借用 succeeded 仅验证依赖，最终合同禁止把已处理游标说成成功。
- 耗时：见日志 elapsed_ms（组件通常约0.1–0.5秒，协议回路约数十毫秒）；复现率3/3；autonomous。
- 范围：真实生产函数/Preact组件运行，宿主和数据用合成夹具；不冒充完整 Obsidian GUI。#39 open 回调按原文提取执行，防止重写一份行为充当证明。

## 3. 最小复现

从完整 issue 排除无关账户、用户库、插件安装和真实私有历史，保留本票触发所需的最小输入。最小脚本与宿主替身在 <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnostics/</Path>。

- 删除真实网络/真实账户后仍红（#37 保留 loopback 协议，外网仅下载公开资产）。
- 只保留一个记录或一个目标行为即红；#41 保留总量111来触发分页，渲染行只需1条。
- 单变量对照保留全部夹具输入，仅改变判别变量；对照绿色不等于产品已修复。
- 最后原始回路：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnostics/red-3.log</Path>；源码摘要 <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/code-baseline.json</Path>。

## 4. 假设与证伪

在首轮红灯后按契约/事件遗漏、状态投影、外部数据三类候选排名并开展探针；对未复现的视觉子项不列根因假设。

| 排名 | 假设与预测 | 单变量实验 / 反证 | 结论 |
|---|---|---|---|
| 1 | 本地失败机制为下节描述；只改对应变量应改变精确断言 | PROBE_CONTROL=1 的内存构建变体；control.json 指明唯一替换；control.log exit=0 | 已确认限定症状 |
| 2 | 替代解释一 | cursor 被清空导致再次执行：夹具保留 cursor，且 clearHistory 源码只筛 runs，反证。 | 排除 |
| 3 | 替代解释二 | once 时间仍未到：固定 at=1000 远早于运行时间，反证。 | 排除 |

## 5. 已确认根因

运行列表在没有可见 run 时硬回落 pending，忽略持久化调度游标；清理历史仅移除 runs，不清 cursors，所以这是显示误报而非再次执行。日期未传 NAND locale，普通 Error 仅存 message；收件箱 body 是投递时拼接的字符串，只有部分 run.errorCode 支持动态翻译。

代码定位：
- <Path>src/view/automations/AutomationsPanel.tsx</Path>
- <Path>src/view/automations/editor.ts</Path>
- <Path>src/core/automations/service.ts</Path>
- <Path>src/plugin/workflows/automation-host.ts</Path>
- <Path>src/core/notifications/service.ts</Path>
- <Path>src/view/notifications/InboxPanel.tsx</Path>
- <Path>src/plugin/settings/automation-settings.ts</Path>
- <Path>src/shared/automation/types.ts</Path>
- <Path>src/shared/automation/errors.ts</Path>

漏检：已有测试覆盖调度/数据保护和面板组合，未覆盖本次精确输入组合与宿主可观察结果。基线 automation=23/23、contacts=20/20、panel-composition 通过，说明这些绿色不足以证明本票正确；#37 项目测试使用本地服务而未锁定公开发行资产。

## 6. 修复契约

必须改变：按 <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/spec.md</Path> 的验收合同和 <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/tickets-map.md</Path> 切片实施。必须保持：域数据权威、固定身份、生命周期、用户正文和设备/游标/投递去重合同。正确接缝已存在；不需要广泛架构重构。

OUT：缺 CLI 的选择与错误优先级由 #38 唯一拥有；来源路径由 #39 拥有；不翻译用户正文、CLI 输出或猜测旧自由文本错误；不新增后台调度、邮件短信实现。

风险：本轮夹具不能证明真实宿主布局、五平台运行或已有账户功能；对应 Ticket 保留真实 E2E Gate。回滚：撤回局部修改和生成包，不删除或改写用户数据；新版本发布走前向修订，不覆盖旧 tag。

推荐下游：<Path>{roots.workflows}/specdev/S-spec/S-spec.md</Path> → <Path>{roots.workflows}/specdev/T-tickets/T-tickets.md</Path> → <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> 的 plan。

## 7. 清理与证据边界

临时变量替换只存在 esbuild 内存与随机临时目录，finally 删除 bundle；生产源码未插桩，没有遗留 DEBUG 标记。诊断脚本是可复验工件，不是上线修复，归档时由本 change owner 处理。#37 进程在 finally 终止，合成库删除；下载资产仅存临时目录，永久证据保存 URL 和 SHA256。

未运行：当前 Obsidian 完整交互、macOS/Windows 实机、真实账号/费用查询。未把历史截图或旧绿色当成当前成功。

重要：control 的 succeeded 只是验证 cursor 是否影响投影的实验值，不能用于正式修复；游标代表“已处理”，不代表成功。
