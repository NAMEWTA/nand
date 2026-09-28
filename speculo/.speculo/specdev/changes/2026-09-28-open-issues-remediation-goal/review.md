# 当前远程未关闭 Issue 全量核查与修复计划

核查时间：2026-09-28T06:24:45.984710+00:00。origin=NAMEWTA/nand，初始工作区干净，HEAD `09aade655241fff439d3147a55ec1448a4f93eea`。通过 github-npm-ops issue-read 冻结全部9条open issue及所有可见评论；旧未关闭标题不是当前缺陷清单，逐子项以最新评论和当前代码为准。

## 总控与交付

正式总控：<Path>{roots.state}/specdev/changes/2026-09-28-open-issues-remediation-goal/tickets-map.md</Path>；编排：<Path>{roots.state}/specdev/changes/2026-09-28-open-issues-remediation-goal/implementation-plan.md</Path>。

已完成Triage→Diagnose→Spec→Tickets→Goal Plan（plan），9份来源/诊断/Spec、16张ready票、36条AC、9个子Goal及1个跨change总控。父Plan blocked/ready_for_execution=false 是“此次只授权规划”的准确状态；不是代码修复已完成或本次文档任务未完成。子状态全部active，源Issue保持open，未发布票到GitHub。

用户决定：当前工作区严格串行；新增自动化开关，关闭停止自动与手动执行、保留数据和通知历史。未创建worktree/commit，未修改任何生产文件或旧archive/permanent知识。

## 核查结论与优先级

| Issue | 当前确认残留/原因 | 验证范围 | 票数 | 优先级 |
|---|---|---|---|---|
| #37 | 公开最新 Release 仍为 0.0.1，二进制路由仅识别 pty；当前客户端会发 agent_data，旧服务将其解析失败投影为 pty/PARSE_ERROR。并行 PTY 初始化会遇到非自身模块的错误；当前源码服务能够返回对应 requestId 的历史结果。manifest 仍 0.0.1，版本相等检测不能选择尚未发布的新服务。 | 校验 Release Linux x64 SHA256 后发送相同 agent_data+pty 消息：旧资产返回 pty/PARSE_ERROR unknown variant agent_data；cargo build --locked --release 当前服务返回 agent_data result 和 PTY init_complete/exit。旧资产 3/3 红；当前源码对照绿。 | 1 | P1 |
| #38 | 草稿默认选第一个 enabled 智能体，但下拉框还过滤 installed=false；save 仅验证 agentId 非空，不核对当前选项集合。start 在 CLI/cwd 检查前做 yolo acknowledgement，默认未确认时掩盖缺 CLI/目录；permissionRequired 使用普通 Error，又进入不可重新翻译的 message。 | 真实 save 在 available=0 时保存 agentId=claude-code；仅统一默认筛选后保存数为0。start 指向合成缺失 CLI/cwd 得到 permissionRequired，cwdChecks=0，确认先后顺序。 | 1 | P2 |
| #39 | DashboardAutomationSource.files 会补 .md 查找文件，但 widgets.source.path 直接复制 dashboardFile 配置；composition open 用精确 getFileByPath，不做同样规范化。通知与自动化共用该入口，所以两处同错。 | settings.dashboardFile=dashboard 且实际文件 dashboard.md 时，真实 list 产生 source.path=dashboard，实际 open 回调抛 sourceMissing；只补 source 后缀即可 switchWorkspace/dashboardOpen。 | 1 | P2 |
| #30 | 插件 addCommand 仅对 nameKey 建订阅；评论/复制命令与预设工作流只提供启动时的 name。AutomationView、ContactsView、TerminalView 的语言监听只重绘业务内容，未通知宿主刷新标题。 | 语言 zh→en 后 getDisplayText 从“自动化”变成 Automations，draws=2、headerUpdates=0；仅在该订阅增加宿主标题通知后 headerUpdates=1。 | 2 | P3 |
| #31 | 关系清除按钮复用用于筛选的 contacts.clear；标题只判断记录是否有 path，关系新建也走 edit；姓名字段复用一个 name 标签。基本资料没有空字段占位。格式说明是一个固定混合语言资源，和 UI 语言无关。 | 真实 RecordEditorModal 创建关系得到 title=编辑、button=清除筛选；仅改关系按钮标签后该精确断言通过，筛选按钮未动。 | 2 | P3 |
| #32 | 实际合并后的翻译字典仍返回旧字面量，非语言事件或缓存问题：中文两个终端键无空格，intro/body 与 about/introduction 保留 NAND WTA，英文图标菜单使用三个句点。 | 直接调用运行时 t() 得到打开NAND终端、NAND WTA、Change icon...；只改终端中文字面量，品牌空格断言立即通过。品牌和省略号仍保留在对照输出，未把单项绿色当成全部修复。 | 1 | P3 |
| #36 | 运行列表在没有可见 run 时硬回落 pending，忽略持久化调度游标；清理历史仅移除 runs，不清 cursors，所以这是显示误报而非再次执行。日期未传 NAND locale，普通 Error 仅存 message；收件箱 body 是投递时拼接的字符串，只有部分 run.errorCode 支持动态翻译。 | 给真实 AutomationsPanel 输入 runs=[] 且 cursors[once:1]=1000，仍显示“待执行”；只改变 fallback 对 cursor 的读取即可去掉该误报。实验借用 succeeded 仅验证依赖，最终合同禁止把已处理游标说成成功。 | 5 | P2（开关为新增功能） |
| #40 | NativeHistory.export 使用 adapter 将导出写到隐藏的 .nand/terminal-agent/exports，绕过可见 Vault 笔记入口；UI 成功只 Notice(file)，无打开动作。与原生元数据隐藏存储的设计混用了导出目的地。 | 真实 export 得到 .nand/terminal-agent/exports/codex-test-*.md，内容正确；仅改父目录后可见路径断言通过。该夹具验证路径和内容，Obsidian 文件列表/快速切换仍需实机。 | 1 | P3 |
| #41 | 分页用 offset+1/total 混合条目偏移与总量；空态不看 query/filter；日期用宿主默认 locale；收藏归档按钮固定文案；会话列表仅 getTitle+nativeStatus，多个 Terminal 完全相同。原生标题和壳层刷新交 #30。 | 真实 HistorySidebar 在111条、offset=0 时渲染“1 / 111”，zh 语言但日期是9/27/2026；只改分页公式后渲染1–100 / 111。 | 2 | P3 |

## 每条 Issue 的完整材料

| Issue | Source | Diagnosis（含全部子项判定） | Spec | Tickets Map |
|---|---|---|---|---|
| #30 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-30-live-language-refresh/tickets-map.md</Path> |
| #31 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-31-contacts-polish/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-31-contacts-polish/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-31-contacts-polish/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-31-contacts-polish/tickets-map.md</Path> |
| #32 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/tickets-map.md</Path> |
| #36 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/tickets-map.md</Path> |
| #37 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/tickets-map.md</Path> |
| #38 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/tickets-map.md</Path> |
| #39 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-39-widget-source/tickets-map.md</Path> |
| #40 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-40-visible-export/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-40-visible-export/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-40-visible-export/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-40-visible-export/tickets-map.md</Path> |
| #41 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/source.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/diagnosis.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-09-28-issue-41-workbench-usability/tickets-map.md</Path> |

## 关键决策与不能误判的地方

1. #37 按源Issue最新决定发布配套新服务，不做旧服务兼容/协商。公开0.0.1 Linux资产SHA核对后复现模块解析错误；当前源码重编译同请求通过。完整默认安装、五平台和孤儿进程验收仍列发布Gate，未冒充本轮通过。
2. #38 默认值与下拉框集合不一致，且权限检查掩盖实际CLI/cwd问题。#36消费该票产出的稳定错误合同，不能两处各自重写错误优先级。
3. #36 清理运行历史后显示“待执行”是视图忽略cursor，不是已有证据证明重复执行；游标也不能证明成功。正式状态必须表达“已处理/历史已清理”。单变量control临时借用成功词仅用于证伪，明确禁止成为实现补丁。
4. 自动化开关属于用户刚确认的新增产品合同。关闭新触发并收尾本模块在途运行；历史与通知服务只读继续可达，重新开启遵守现有宽限/游标规则，不把已发送外部副作用假装撤回。
5. #31删除恢复/字段/表头、空分页和自由文字语言effect等已修或已有明确代码变化；#30稳定ribbon身份、#32多数旧文案和#36大部分通知功能已有修复。全部在Diagnosis按子项列明，保留回归而非再次造修复。
6. #31筛选缩进、#36长列表实际布局、#41筛选压缩和状态栏遮挡仍需当前Obsidian测量；#41已有wrap修正，不能凭旧截图断言仍坏。票据要求先复现、只修改确认的局部问题；没有伪造GUI截图或宣称完整E2E。
7. 默认导出目录锁定为可见 NAND Exports，成功打开笔记、重名不覆盖，旧隐藏导出保留；不新增配置UI或移动原生数据。档案格式说明只为新生成的说明选语言，用户已有说明不覆盖。

## 串行执行与恢复

跨change依赖：#36/T-01 ← #38/T-01；#41/T-02 ← #30/T-02。内部依赖精确投影子票，全部120对组合票声明共享current writer的serialization；每Wave一票，Lead唯一写者，无子agent。父Map是组合图权威，子票仍是自身合同与状态权威。

建议先#37（默认安装P1），然后#38/#39功能缺陷，再语言/档案/导出/工作台；#36完整呈现与模块开关依赖就绪后实施。#37发布缺授权不能当done，也不能阻塞其它独立已授权票。由父tickets-map恢复，不能绕过父owner独立写某个child。

## 实际验证与局限

- 9份Source正文hash校验通过；每条原始正文和全部可见评论保留。
- 9个子change的triage/diagnosis/spec/tickets/goal-plan阶段与父goal-plan均0 error；各ticket-control及父controller均成功运行。
- 子#30/#31独立票共享main.js有静态提醒：已指定同一Lead，父120条serialization和current单writer明确消解；未把资源串行伪造为语义依赖。
- 8组当前代码精确红灯各连续3次失败，单变量内存构建对照成功；#37公开旧服务3次协议红灯，对照为当时刚编译的当前服务。probe日志保留exit语义和elapsed_ms。
- automation 23/23、contacts 20/20、panel-composition通过；build通过；lint 0 error / 157既有warning；生产文件与main.js无Git diff。
- 本轮没有当前Obsidian完整GUI、macOS/Windows实机或真实账号验证；这些是实施/发布Gate。权限环境途中收紧后，重新运行包装器时子Node进程启动返回EPERM，未进入协议测试，不能重写已捕获的早先协议证据；未来重跑需允许本地WS及公开资产下载的环境。

证据索引：本父evidence下的final-audit.json、validation-goal-plan.log、ticket-control.json、build/lint/定向测试日志；各child diagnostics保存红灯和control，evidence保存源码摘要、阶段校验和计划质量审查。原始失败日志是缺陷证明，不应要求它们本轮全部变绿。
