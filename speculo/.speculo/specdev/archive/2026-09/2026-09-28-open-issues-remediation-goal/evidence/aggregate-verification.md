# 联合实施与验收（完成）

公开版本：[0.0.3](https://github.com/NAMEWTA/nand/releases/tag/0.0.3)，源码提交`301b74713b0a2f38d5159aaabbe64debcbda9296`。16/16票done、36/36条AC passed；所有发行及required E2E门均闭合。

## 合同逐项对账

| Change / AC | 行为 | Ticket / Evidence | 状态 |
|---|---|---|---|
| 30/AC-001 | 语言双向切换后评论、两种复制引用及六个内置工作流命令立即显示当前语言，不须重启。 | [T-01](../../2026-09-28-issue-30-live-language-refresh/evidence/T-01.md) | passed |
| 30/AC-002 | 自定义脚本名称原样保留，只翻译工作流前缀；注册命令 ID 与快捷键不变。 | [T-01](../../2026-09-28-issue-30-live-language-refresh/evidence/T-01.md) | passed |
| 30/AC-003 | 所有已打开 NAND 叶子在 zh↔en 时即时更新标题并保持当前选中项/会话；延迟加载叶子加载后使用当前语言。 | [T-02](../../2026-09-28-issue-30-live-language-refresh/evidence/T-02.md) | passed |
| 30/AC-004 | 标题刷新不卸载 PTY 或丢失 Preact 状态；保留固定 view type 与 ribbon ID。 | [T-02](../../2026-09-28-issue-30-live-language-refresh/evidence/T-02.md) | passed |
| 31/AC-001 | 关系新增/编辑、人物/企业新增编辑有明确标题；清除关联企业叫“清除/Clear”，筛选保留“清除筛选”。 | [T-01](../../2026-09-28-issue-31-contacts-polish/evidence/T-01.md) | passed |
| 31/AC-002 | 名称字段按人物/企业显示；基本资料无内容有占位；语言切换空白 prose 跟随语言。 | [T-01](../../2026-09-28-issue-31-contacts-polish/evidence/T-01.md) | passed |
| 31/AC-003 | 首次生成的说明全文使用当前 NAND 语言，保留实际机器字段/标记以及中英文表头读取规则。 | [T-02](../../2026-09-28-issue-31-contacts-polish/evidence/T-02.md) | passed |
| 31/AC-004 | 已有档案和说明逐字保留；企业改名不改文件名的行为继续写明。 | [T-02](../../2026-09-28-issue-31-contacts-polish/evidence/T-02.md) | passed |
| 32/AC-001 | 中文终端 tooltip/命令均为“打开 NAND 终端”；英文图标菜单为“Change icon…”。 | [T-01](../../2026-09-28-issue-32-product-copy/evidence/T-01.md) | passed |
| 32/AC-002 | 介绍与关于页作者品牌统一 NAMEWTA；中英文均覆盖，许可证/上游 attribution 不动。 | [T-01](../../2026-09-28-issue-32-product-copy/evidence/T-01.md) | passed |
| 36/AC-001 | 新产生的系统失败原因保存稳定 code/params，运行与收件箱按当前 NAND 语言呈现；旧自由文本安全回退原文，绝不猜测翻译。 | [T-01](../../2026-09-28-issue-36-automation-presentation/evidence/T-01.md) | passed |
| 36/AC-002 | 自动化日期与冒号遵循当前语言；用户输入/CLI 输出不翻译，已送到系统通知的历史文本不承诺追溯更改。 | [T-01](../../2026-09-28-issue-36-automation-presentation/evidence/T-01.md) | passed |
| 36/AC-003 | 提醒标题和正文完全相同时只显示一次，原始定义与投递回执不变。 | [T-01](../../2026-09-28-issue-36-automation-presentation/evidence/T-01.md) | passed |
| 36/AC-004 | 一次性定义游标已覆盖触发点而历史已清理时显示“已执行（历史已清理）/已处理”，不得标待执行，也不得伪称运行成功。 | [T-02](../../2026-09-28-issue-36-automation-presentation/evidence/T-02.md) | passed |
| 36/AC-005 | 清理后 tick 与重启不再次执行；未触发一次性与循环/手动定义状态仍正确。 | [T-02](../../2026-09-28-issue-36-automation-presentation/evidence/T-02.md) | passed |
| 36/AC-006 | 两个筛选分别有可见动作/状态与智能体标签，保留 aria-label；正文普通字体保留换行，CLI output 仍等宽。 | [T-03](../../2026-09-28-issue-36-automation-presentation/evidence/T-03.md) | passed |
| 36/AC-007 | 新建/编辑标题不同；长列表滚动后工具和选中详情仍可操作，窄屏自然堆叠不横向溢出。 | [T-03](../../2026-09-28-issue-36-automation-presentation/evidence/T-03.md) | passed |
| 36/AC-008 | 命令显示“打开自动化/打开通知中心”，页面名不加动词；双向切换仍更新。 | [T-04](../../2026-09-28-issue-36-automation-presentation/evidence/T-04.md) | passed |
| 36/AC-009 | 设置中的通知渠道/会话方式明确是使用说明，指向现有编辑入口，不表现为缺失控件；去掉重复标题。 | [T-04](../../2026-09-28-issue-36-automation-presentation/evidence/T-04.md) | passed |
| 36/AC-010 | 首页提供独立自动化开关，旧设置缺字段时默认开启以保持既有行为；关闭后定时/手动入口均不能启动新运行。 | [T-05](../../2026-09-28-issue-36-automation-presentation/evidence/T-05.md) | passed |
| 36/AC-011 | 关闭前已开始的自动化自有 agent 执行按现有 stop 合同停止并落盘终态；已送达通知/已完成文件副作用不可撤销，不影响独立手动终端。 | [T-05](../../2026-09-28-issue-36-automation-presentation/evidence/T-05.md) | passed |
| 36/AC-012 | 定义、运行日志、游标和通知历史不删除；关闭时仍可只读查看历史及操作通知已读；重启仍关闭。 | [T-05](../../2026-09-28-issue-36-automation-presentation/evidence/T-05.md) | passed |
| 36/AC-013 | 重新开启只按既有游标、宽限和设备规则评估未处理触发，不重放已有游标覆盖的事件；不得让旧服务/定时器重复订阅。 | [T-05](../../2026-09-28-issue-36-automation-presentation/evidence/T-05.md) | passed |
| 37/AC-001 | 新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。 | [T-01](../../2026-09-28-issue-37-terminal-release/evidence/T-01.md) | passed |
| 37/AC-002 | 新 Release 默认安装首次终端成功、历史/用量/导出/恢复可用，关闭后无孤儿进程，控制台无 agent_data 解析错误。 | [T-01](../../2026-09-28-issue-37-terminal-release/evidence/T-01.md) | passed |
| 38/AC-001 | 新建默认值来自实际可选列表；空列表不能保存 agent 动作；编辑失效选择时清楚提示而不替换成别的智能体。 | [T-01](../../2026-09-28-issue-38-agent-preflight/evidence/T-01.md) | passed |
| 38/AC-002 | 执行前按启用、CLI、库内cwd、权限、会话依次检查；缺 CLI/目录返回各自稳定 code，权限未确认仍禁止启动。 | [T-01](../../2026-09-28-issue-38-agent-preflight/evidence/T-01.md) | passed |
| 39/AC-001 | 倒计时/纪念日来源带真实可解析看板路径，从通知或自动化点击能打开所属看板并定位对应 widget id。 | [T-01](../../2026-09-28-issue-39-widget-source/evidence/T-01.md) | passed |
| 39/AC-002 | 读取旧省略.md的 widget 来源可打开；文件/部件确实被删时提示清楚且无 Error: 前缀；不误报重复任务标识。 | [T-01](../../2026-09-28-issue-39-widget-source/evidence/T-01.md) | passed |
| 40/AC-001 | 导出写到库内 NAND Exports 普通目录，通过 Vault 笔记接口创建并成功后打开；Obsidian 文件列表与快速切换可找到。 | [T-01](../../2026-09-28-issue-40-visible-export/evidence/T-01.md) | passed |
| 40/AC-002 | 内容/标题与选中历史一致，重名不覆盖、非法字符安全化；读取或写入失败有本地化错误且不谎报成功，原生记录逐字不变。 | [T-01](../../2026-09-28-issue-40-visible-export/evidence/T-01.md) | passed |
| 41/AC-001 | 中文日期按 NAND 语言格式、英文按英文；分页显示条目范围/总数，101/111末页正确，搜索无匹配不同于空库。 | [T-01](../../2026-09-28-issue-41-workbench-usability/evidence/T-01.md) | passed |
| 41/AC-002 | 收藏/归档操作后预览按钮明确“取消收藏/取消归档”并有状态，切换列表过滤后页码边界正确。 | [T-01](../../2026-09-28-issue-41-workbench-usability/evidence/T-01.md) | passed |
| 41/AC-003 | 同时打开两个同名终端时可用稳定短会话标识区分，重绘/切换不重新编号或错选；未知状态仍标未知。 | [T-02](../../2026-09-28-issue-41-workbench-usability/evidence/T-02.md) | passed |
| 41/AC-004 | 看板显示为“看板/Dashboard”，终端组合界面为智能体工作台，持久化 view type 不变。 | [T-02](../../2026-09-28-issue-41-workbench-usability/evidence/T-02.md) | passed |
| 41/AC-005 | 100+历史筛选控件保持宿主正常可读高度；800px及窄leaf用量文字可达且不被状态栏遮挡。 | [T-02](../../2026-09-28-issue-41-workbench-usability/evidence/T-02.md) | passed |

## 聚合验证

最终源码对应上述tag；main后续仅追加验收证据。automations/terminal/settings/mobile/architecture等复用同一生产字节的末次通过记录；跨平台路径修复后Rust30、terminal190、PTY、build/lint再次通过。没有将基线或PROBE_CONTROL当成通过证据。

- 自动化37、终端190、设置21、档案22、图标8、移动交互5测试通过；跨面板与581模块架构检查通过。
- Rust30测试、真实WebSocket PTY/历史/已知用量/退出/取消/只读原生日志与进程树清理通过。
- Node22/24 main CI36417025301通过；公开发行run36417073903的五平台native build/test及release六个job全部成功。
- 全新profile/Vault仅安装公开zip三文件，默认GitHub服务下载首次PTY成功，服务摘要匹配公开资产；真实GUI历史/未知用量、zh/en/zh三份可见导出、合成CLI恢复、模块启停与真实进程重启/退出全部通过。既有导出与原生日志字节不变，无agent_data解析错误，无孤儿服务/shell。
- 各票真实Obsidian中英往返、窄叶子/主题、自动化总开关跨域保存和重启流程见对应截图/JSON。
- 9份冻结Source SHA256核验；16个implementation提交直接父/祖先/写集及required suite/E2E核验，见integration-audit.json。
- 9个子票schema、父ticket-control均0错误；历史HEAD假设限制由实际Git父子审计补足。
- build通过；lint 0 errors/157既有warnings。

## 发布记录与限制

用户明确授权最后步骤。0.0.2 CI发现macOS/Windows路径规范化问题后阻止发布，保留原tag；补回归及修复后递增0.0.3，原workflow创建公开Release。11个公开资产重新下载，五binary摘要通过，zip逐字节匹配tag源码。证据见#37/public-003。未评论或关闭issue。

GUI实际覆盖Linux与合成CLI，没有冒称macOS/WindowsGUI或真实账号额度验证。历史规划快照保留planning-snapshot/，当前final-audit.json与implementation-control.json才是完成状态。
