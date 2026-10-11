---
schema_version: 3
artifact: "spec"
change: "2026-10-08-news-aihot"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Spec: 本地新闻工作台与 Agent 分析

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 10 票、28 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

深读 AIHOT 固定提交后按 NAND 模块、工作台、设置、Markdown 和 Agent CLI 契约重写完整新闻能力：采集、可解释精选、事件归组、热度、日报、收藏/简报、我的视图及首页组件；保留 OPML、静态网页列表、可选双评分与七天曲线。仅做本轮完整规划；后续 current 严格串行。

### 规划时基线

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### 目标用户与场景

- 作为读者，我在设置配置少量信源，刷新后在同一工作台查看按兴趣筛过的新闻、热点和要闻，能看见来源、时间、分数和分析状态。
- 作为已有 Agent CLI 用户，我复用已登录账号完成程序发起的新闻分析，知道每次调用的结果、权限等待、时间、用量和上限。
- 作为收集信息的笔记用户，我保存新闻及深入了解简报为可编辑Markdown，保留自己的批注，卸载插件也能阅读。
- 作为首页用户，我添加多个新闻小组件并分别选热点、精选或我的视图，点击准确进入新闻详情。
- 作为维护者，我能够追溯AIHOT参考与NAND差异，通过确定样本和真实宿主验收关键行为，无需多重兜底架构。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。
- 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。
- 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。
- 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。
- 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。

## 2. 解决方案与外部行为

启用与刷新：news默认关闭。用户在功能管理启用后进入工作台新闻页或设置，尚未添加信源时显示可操作空态。手动刷新抓取到期信源；opt-in stale默认阈值60分钟、startup默认关；多页面/组件同一刷新归并为一个service任务。周期采集默认关。服务按到期/退避控制网络并发，AI同时只跑一批。渲染与navigate不启动CLI或网络；服务接收明确动作或已授权策略事件。关闭news取消自有运行、timer、listener和UI订阅，关闭agent使依赖runner明确中断，原有手动Agent/自动化不受news关闭影响。

采集：保存原始URL与独立canonical identity；统一https/host/no-www、去fragment/跟踪参数、排序query、规范pathname尾斜线，保留业务参数。静态web-list明确选择保留fragment用于同页发布条目。RSS2/Atom正确处理namespace、CDATA、text/html/xhtml、xml:base/relative alternate link；JSON Feed支持1/1.1稳定id与content_text/content_html，不能把上游generic JSON-list误称该标准。requestUrl输入转纯材料，raw HTML不得直接注入UI。成功落盘后才推进ETag/LastModified/cursor；失败单源退避，其他源继续。标题/正文/摘要规范空白后哈希变化才形成修订；重复URL/内容不再分析。首次导入存量、发现时超过48h、无可靠日期或未来超过1h不进今天；不把抓取时间冒充发布时间。自适应按最近7天非backfill条数/7，日均≤0.15取上限，否则round(clamp(1440/(daily×3),15,60))，signal可到180；失败按旧failCount+2乘间隔，上限360分钟，5连续失败failing；成功清零。

分析与运行：选已启用可用CLI、vault内cwd，沿用原生账号与权限，先持久化run receipt再启动。复用home目录contract和agent公共runner，不制造automation定义/run。按默认12条/1500正文字符与实测argv/UTF8结果上限同时分批；每批默认10分钟。完成事件只是完成证据，回读必须完整，不能从ANSI截尾解析。按CLI能力使用hook最后答案或native记录；结果文件是显式可选且遵循CLI写权限，不自动轮换多个兜底渠道。native completion大文本不得静默丢事件。默认完成后关闭专用交互terminal，可保留供查看；无论保留与否模块关闭都清理自有进程。needs-attention显示打开终端；cancel/timeout/CLI/helper缺失/agent关闭各自可见错误，不能卡分析中。

结果合同：标记包裹一个JSON，带本批material id、relevance、itemType、axes、scope/subject/frame、category/tags、中文标题/摘要/理由、关系和候选target/confidence。校验schema、已知id、0..10整数、白名单、候选target；未知id忽略并记录，缺id资料标待重试；格式修复只同会话追加一次“只返回JSON”，再坏则failed。原始结果先持久化再应用。相同revision/effectivePromptVersion/agent账户/sample键重用；每次实际调用包括repair、双评分、深入了解都计每日默认20次预算。无新材料不调用，unknown usage如实展示。重启已启动未知结果标interrupted，只手动重试；未启动资料可下次授权刷新处理；received结果可本地应用不花额度。

评分：material评分输入不含tier/source-name/first-party，按7类五维给整数，程序加权。矩阵按issue7行：model 3/2/2/2/1、product 2/2/1/2/3、tool 1/2/1/2/4、research 5/3/1/0/1、industry 3/1/2/4/0、opinion 1/3/1/4/1、tutorial 1/1/1/3/4，各行和10。类型/事件口径、营销/预告/小更新压分及标题正文冲突≤30保留，质量cap独立于可调权重。默认单评分；开启双评分需第二次独立调用且不带第一次结果。显示floor均分，入选按sum≥sampleCount×tier(60/65/76)，没有threshold不精选；strict >50使用精选写法。BLOCK隔离；UNKNOWN不当BLOCK，材料不足等待补充，不编摘要。有效写作和归组确认后才能精选。权重/门槛/热度/日报设置改变只重算已有分析，不调用模型；prompt/画像改变产生新有效版本只影响新材料，显式重分析另计预算。

分组：召回发现时间最近14天候选，以title+前300摘要字符的去空白字符二元组intersection/min(set sizes)≥0.25，每发生最佳报告且前10；不把cosine阈值套在lexical上。SAME_OCCURRENCE≥0.8归同发生，SAME_STORY≥0.8关联根发生为进展，UNRELATED分开；ROUNDUP只mentions多个事件而不合并它们。低信心不自动释放精选；同批材料间也判重/归组。合并已有事件保留alias深链，复核阈值0.75，不能用任意后续链滚成大主题。代表先选报道源最多发生、平手早者，然后在发生内T1、owner与subject一致机构/个人、全文、分数、早时、稳定id。未验证publisher不称官方。

热点：参与方依author(明确community源)/group/owner/source归并，isolated与撤回不计、editorial必须是事件事实证据。每参与方在(t-48h,t]最后原文时间计0.5^(Δh/24)，sum为raw heat，展示round(raw×100)/10；至少2参与方且1editorial，热度降序同分最近，前10。相对6h前自己的48h窗口计算趋势，只比较持续覆盖的cohort：源落后max(3interval,90min)或在先前窗口开始后加入不计涨跌。旧总体heat0为new，可比不足unknown，>10%up、<−10%down；surge新参与≥3且≥50%，首报<6h为new，非surge且>15%rising。小时快照7天，不完整小时留缺口，少于3观测点不画曲线；可选24h/3天/7天。模块仅在运行时记录，不能伪造停机历史。参数修改基于已有信号重算，保留ruleVersion。

要闻/视图/详情：今日按设备时区自然日编排，从已有分析选每事件一条，importance=(score??50)+5log2(1+参与方)+官方5−跟进6，正文12/快讯10/每源2/记忆7期。已报事件仅新发生当事方动作或≥4源报道才正文，其他快讯；保留上游整天全是跟进时仍可正文规则。官方+≥3参与、无精选可补日报；ROUNDUP挂最重要事件；不调用AI排序。显示精选/全部/热点/今日/收藏/信源/运行记录；②栏立即刷新、我的视图、分类、源健康、最近运行及搜索；③栏按日阅读流/事件折叠/热点/详情/运行状态。详情标题摘要理由/评分维度/来源日期/标签、正倒序进展、原文、收藏、不感兴趣、发送到Agent（只粘贴）。分类/tag/source/minScore/query可保存我的视图，页状态独立getState/stateKeys跨分屏和重启恢复。

内容保存与深入了解：收藏写可见Markdown，有稳定新闻身份和原文来源，反复收藏不重复创建，用户批注不覆盖。深入了解仅显式点击，把事件报道和关注点发runner，生成背景/影响/时间线、有出处链接的简报，成功写Markdown再显示保存成功；只有日报写笔记开关开启才生成日报文件。缓存清理不删收藏/简报/日报。通知用幂等news-run id、用户设定channel和仅失败默认，notifications关闭不影响处理；其target不得伪造成automation。

首页与P5：通过home统一registry贡献热点TopN/精选/指定视图，各实例条数/view/summary/staleThreshold独立。仅peek读news，不顺带启用；module off由home提供未知/不可用kind占位且保留实例数据；点条目到准确详情，标题到新闻主页，显示更新时点和真实进度。贡献层不静态导入UI，module.ts传lazy loader以遵循zone matrix。OPML能导入导出且URL去重保留已有源；静态web-list用配置item/link/title/date selectors预览、试抓后走同pipeline，不执行页面JS或引入登录/付费抓取。全部设置集中新闻分类，native Setting rows，en/zh，保存错误可见。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为读者，我在设置配置少量信源，刷新后在同一工作台查看按兴趣筛过的新闻、热点和要闻，能看见来源、时间、分数和分析状态。
- **US-002**：作为已有 Agent CLI 用户，我复用已登录账号完成程序发起的新闻分析，知道每次调用的结果、权限等待、时间、用量和上限。
- **US-003**：作为收集信息的笔记用户，我保存新闻及深入了解简报为可编辑Markdown，保留自己的批注，卸载插件也能阅读。
- **US-004**：作为首页用户，我添加多个新闻小组件并分别选热点、精选或我的视图，点击准确进入新闻详情。
- **US-005**：作为维护者，我能够追溯AIHOT参考与NAND差异，通过确定样本和真实宿主验收关键行为，无需多重兜底架构。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | news默认关闭且未配置源 | 启用、打开新闻页/设置、关闭再开启 | 入口、可操作空态和native设置出现；关闭释放自有资源，再开加载已有数据且其他模块运行不变 | ModuleRegistry + News service lifetime；真实Obsidian module switch |
| AC-002 | RSS2/Atom/JSON Feed规范fixture和合法源 | 试抓并正式刷新 | 解析正文/摘要/日期/相对链接与稳定id，写入后显示原始列表；失败源不影响其它源 | 拟新增feed-reader纯归一化出口，requestUrl adapter |
| AC-003 | 同URL含utm/www/fragment/尾斜线别名、正文有修订 | 连续采集 | 别名一份material；同hash不分析，正文变化只加1revision；保留originalUrl；preserveFragment源不同anchor不合一 | core/materials identity/revision |
| AC-004 | 首次导入、48h及48h+1旧文、未知/未来日期 | 归档与进入今天视图 | 初导存量/超48h/无可靠时间不进今天；未知不伪造时间；补日期仍按首次发现判断 | core/materials timeline clock fixtures |
| AC-005 | 源近期产出/失败计数给定 | 刷新和自适应重算 | 15–60普通间隔、signal上限180、首次失败2倍/上限360、5次failing、成功归零；未到期不抓 | core/source-schedule clock fixtures + health UI |
| AC-006 | 终端组件可用及真实Claude/Codex账号，6CLI版本记录 | 逐CLI发送长prompt、完成、读回结构化JSON | 至少Claude/Codex真实完整回读入库；其余实测支持/未测限制逐项记录；无模型API与automation定义/run | AGENT_PROMPT_RUNNER真实PTY/native hook/transcript |
| AC-007 | runner启动或等待CLI权限 | 取消、超时、关闭news/agent、缺CLI/helper、超长输出 | 全部返回明确终态或needs-attention，权限能打开terminal；不永久分析中；timeout结束真实进程；默认完成关闭自有terminal | agent runtime/runner与真实terminal状态 |
| AC-008 | 输出含非法JSON/未知id/缺id/非法axes/候选target | 解析并一次格式修复 | 结构约束有效；未知id忽略、缺id待重试；只1次修复；仍坏failed，不将ANSI截尾当答案 | core/analysis parse + runner continuation |
| AC-009 | 同revision/prompt/agent有结果或重启中断 | 重复刷新、恢复、手动重试 | 已完成/received不再次调用；启动未知interrupted只手动重试；未启动可继续；结果先落盘再应用 | analysis-service durable receipt seam |
| AC-010 | 每日预算20、repair/双评分/brief活动 | 实际调用与到上限后的继续请求 | 每次真实发送都计数，达到20停止提示；无新资料0调用；unknown usage不显示0成本 | analysis-service budget ledger + RunHistory |
| AC-011 | 七类固定axes、T1/T1_5/T2、不精选tier | 单/双评分并修改权重门槛 | 整数加权和及floor均值正确；sum门槛60/65/76；strict >50写法；质量cap生效；改权重立即重排0新调用 | core/scoring fixture table + settings subscription |
| AC-012 | 可编辑模板/画像和已分析材料 | 改prompt、恢复默认、新材料分析 | hash覆盖有效模板与依赖；新材料新版本，旧结果不自动重算；评分payload不含tier/source名/first-party | core/prompts build/version contract |
| AC-013 | 同次报道、跟进、独立发布、ROUNDUP及同批重复样本 | 召回并判断关系 | 14天0.25 bigram前10；同发生合一、跟进根事件新occurrence、独立分开；ROUNDUP不桥接；低信心待确认；同批不重复开event | core/grouping + analysis relation output |
| AC-014 | 多个occurrence与T1/机构/个人/媒体报道 | 选代表并合并事件 | 先最多源occurrence、平手早者，后authority/fulltext/score/time/id；旧event深链仍到合并后事件 | core/representative + event alias resolution |
| AC-015 | 固定clock、同组/owner/author/isolated/撤回资料 | 计算热点及修改source参与方式 | 每参与方最新原文时间一次；48h/24h公式、heatIndex、2参与+1editorial、Top10稳定；设置变化立即重算 | core/heat deterministic fixtures |
| AC-016 | 6h前窗口、晚加入/落后源、无可比或无旧热度 | 呈现趋势与角标 | new/up/down/flat/unknown正确；>10%方向、>15%rising、surge≥3且≥50%；late/stale不造涨幅 | core/heat coverage/cohort contract |
| AC-017 | 小时观测有缺口且已运行若干天 | 查看24h/3天/7天曲线并键盘选择 | 未观测不补0、少于3点不画、完整小时可比cohort；曲线标真实范围，键盘左右/esc有效 | HeatSnapshot read model + real HeatChart |
| AC-018 | 已有分析、7期记忆、官方补入/跟进/roundup样本 | 打开今日要闻、可选保存 | 12正文10快讯每源2；公式、7日记忆、官方3参与补入、4源/当事动作、全跟进特例；排序0AI；仅开关开启写日报 | core/edition deterministic fixtures + Markdown writer |
| AC-019 | 多个资料与筛选条件 | 切七section、筛选并保存我的视图、重启/分屏 | 分类/tag/source/minScore/query筛选正确，稳定view id可恢复；当前section/筛选/选中条目按leaf隔离 | NewsPage PageCreate getState/stateKeys + real restart |
| AC-020 | 详情存在同事件其他报道 | 查看分数、时间线、已读/不感兴趣、原文、发Agent | 中文标题摘要理由及来源可追溯，正倒序正确；隐藏选择生效；原文点击才打开；attachMaterial仅粘贴不发送 | EventDetail/AnalysisDetail + BROWSER_OPEN/AGENT_SESSIONS |
| AC-021 | 用户收藏并编辑我的批注 | 反复收藏/刷新、清缓存、卸载插件 | 一份稳定Markdown，字段和正文golden往返；不覆盖批注/未存编辑；清缓存/卸载后仍可读且可重新索引收藏 | test/golden/user-formats.test.ts + vault notes |
| AC-022 | 事件有来源、runner额度可用 | 点击深入了解并成功/失败写笔记 | 生成背景/影响/时间线且带来源链接；成功耐久写后显示保存完成，失败不覆盖已有笔记；计quota | Brief request + runner + notes + detail |
| AC-023 | home registry完成，news服务可用或关闭 | 添加三种组件、多实例设置与点击 | 配置分别生效、更新/分析进度准确、条目深链正确；news off占位保配置且peek不启用；恢复重新读 | home public registry + NEWS_READ service |
| AC-024 | 已有源与包含重复URL的OPML | 导入、导出、重导 | 保留原源、按URL去重，受支持源配置可往返；不静默覆写已有分级/组 | platform/opml adapter + source settings |
| AC-025 | 静态HTML列表与用户selectors | 预览、试抓、正式导入、遇不支持页面 | 选定链接/标题/日期正确进入同pipeline；不执行JS、不使用付费源；无匹配给明确修正提示 | platform/web-list-reader + source preview |
| AC-026 | 完成/失败通知策略及notifications可用 | 处理run后重复发布通知、点击通知 | 幂等news-run id只送一次并打开相关新闻记录；notifications关闭不阻塞处理，不伪造automation target | NOTIFICATION_INBOX + NOTIFICATION_OPENERS |
| AC-027 | 实现完成且源码/样式变更 | 运行工程gate并真实Obsidian验收 | build/lint/i18n/architecture/budget/CSS/docs通过；main.js/styles.css重建；三宽度/深浅/presets/键盘/popout/重启/关闭无残留；手机Markdown可读 | 现有pnpm脚本 + scripts/obsidian-acceptance/workbench-fresh-runtime.mjs |
| AC-028 | 自主改编算法/prompt和发布文档 | 审查对照表与NOTICE/源码头/文档 | 第三节全规则有来源SHA/函数/NAND落点/差异/用例；MIT版权license保留，界面无AIHOT品牌；P5无缺漏，未实测能力不宣称验证 | docs/third-party/aihot-news.md/.ZH.md + NOTICE + docs/news.md/.ZH.md |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- news模块开关、workbench入口/侧栏/独立页、native设置页及双语文案；关闭清理和重启/分屏状态恢复。
- RSS/Atom/JSON Feed及静态web-list，信源配置/试抓/健康、OPML导入导出、判重修订、旧文归档、自适应间隔/失败退避。
- Agent一次性prompt runner、完整结果回读、六CLI能力探针、超时/取消/权限等待、格式一次修复、批次与预算/收据/幂等。
- 用户画像/主题、屏蔽词、分类白名单、四类可编辑prompt/hash/reset、七类五维权重、分级门槛、单/双评分与即时重排。
- 发生/事件层级、14天字符二元组召回、四种关系与置信度、代表稿、独立参与方热度、趋势角标/小时快照/七天曲线。
- 精选/全部/热点/今日要闻/收藏/信源/运行记录、筛选与我的视图、原文/发送到Agent/不感兴趣/已读。
- 收藏Markdown、可选日报、深入了解简报；首页三种多实例组件；幂等通知；用户/数据/许可文档与真实Obsidian验收。

### REUSE

- ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。
- home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。
- AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。
- JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。

### OUT

- **OOS-001**：不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。
- **OOS-002**：不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。
- **OOS-003**：不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。
- **OOS-004**：不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。
- **OOS-005**：周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。

## 6. 已锁定实现约束

- **DEC-001**：news 默认关闭；桌面提供完整采集和 Agent 分析；手机通过 Obsidian 阅读同步的收藏、日报和简报 Markdown，不承诺设备缓存自动跨设备共享或手机CLI。 来源：LOG-001；本轮用户明确确认；dev module-authoring 远程/进程模块 defaultEnabled=false。
- **DEC-002**：保留手动刷新；过期打开刷新与启动刷新均为 opt-in；运行期间周期采集默认关闭，若用户启用只能由 news 自有调度，不建自动化定义或cron。UI render/navigate保持纯读，已启用策略由服务处理可见事件并去重。 来源：LOG-002；本轮用户明确确认；#136第五节；ui shell规则。
- **DEC-003**：提供两次独立评分，默认关闭；开启后两次实际调用且第二次不带第一次结果，均计调用预算；显示floor平均，入选按原始分数和。 来源：LOG-003；本轮用户明确确认；#136第七/八节；AIHOT analyze.ts。
- **DEC-004**：已启动但结果未知的AI批次重启后标中断，只能手动重试；未启动资料可在下次授权刷新排队；已收到原始结果可继续本地应用，不能重叫CLI。 来源：LOG-004；本轮用户明确确认；#136幂等与中断要求。
- **DEC-005**：OPML、静态网页列表、双评分、7天曲线均在本change完整范围；不是以首版为由移除。 来源：LOG-005；本轮用户明确确认；#136 P5。
- **DEC-006**：依赖home change提供的公共Agent目录/派发入口；新闻仅新增AGENT_PROMPT_RUNNER结构化一次性执行接口，内部复用agent现有runtime，不伪造AutomationRun，不重复定义公共目录。首页小组件依赖home统一注册表，不同时造临时注册路径。 来源：LOG-006；本轮父代理跨change协调；#136第五节。
- **DEC-007**：Event内保留occurrences而不是只Material→Event。SAME_OCCURRENCE合发生，SAME_STORY关联根发生形成进展，ROUNDUP只引用不桥接；代表稿和日报按发生身份计算。 来源：LOG-007；AIHOT group.ts、recall.ts、edition.ts源码事实；#136要求对应推导。
- **DEC-008**：配置namespace和设备JsonStore，用户收藏/日报/简报为可见Markdown；自主重写算法/提示词时保留MIT版权和SHA映射；不使用AIHOT名称Logo、Postgres/服务端/模型API。 来源：LOG-008；#136第二、六、十节；dev licensing/data规则。
- **DEC-009**：本轮完成分组、参考研究、change/spec/tickets/goal-plan；不把文档规划标为代码完成。所有必要修复有执行票及验收；后续current严格串行。 来源：LOG-009；本轮用户明确确认。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

现有公共接口位置：<Path>src/modules/agent/api.ts</Path>、<Path>src/modules/home/api.ts</Path>、<Path>src/modules/browser/api.ts</Path>、<Path>src/modules/notifications/api.ts</Path>。拟新增news/api.ts只导出类型/service keys。AGENT_PROMPT_RUNNER请求{agentId,cwd,prompt,title,timeoutMs,signal?,reveal?,keepTerminal?,resultChannel?}，返回完整{text,status:succeeded|failed|cancelled|interrupted|timeout,usage?,terminalId,errorCode?}并暴露running/needs-attention变化；公共agent目录从home-owner contract复用。共享底层执行独立于AutomationRun，由自动化adapter保持旧签名；无新进程管理器。

SourceConfig{id,name,type:rss|atom|jsonfeed|web-list,url,tier,participation:editorial|signal|isolated,participantStrategy/groupId/ownerEntityId,publisherRole,intervalMinutes,enabled,selectors?}存vault配置；SourceHealth{lastAttempt,lastSuccess,failureCount,nextDue,initializedAt,etag,lastModified,configHash}存设备运行数据。Material{id,sourceId,sourceItemId,originalUrl,canonicalKey,title,author,bodyExcerpt,publishedAt,claimedAt,discoveredAt,revision,contentHash,backfillReason}；Analysis{materialId,revision,contentHash,effectivePromptVersion,agentId,accountIdentity,samples:axes[],itemType,scoreCap,relevance,scope,category,tags,subjects,frame,titleZh,summaryZh,reason,createdAt}。score/selected为派生值，存原始axes可重算。

Event{id,title,occurrences:[{id,frame,materialIds,rootRelation,confidence}],roundupMentions,firstAt,latestAt,representative,mergedInto?}；同一发生与事件后续明确区分，merge alias保留收藏与深链。HeatSnapshot{eventId,hour,heat,participantCount,cohort,complete,ruleVersion}。RunReceipt{id,batchId,trigger,materialRevisionIds,promptVersion,agent/account,sample/attempt,state,startedAt,endedAt,rawResult/hash,usageKnown,errorCode,terminalId}；raw result先于business apply落盘。NewsView{id,name,filters:{category,tags,sourceIds,minScore,query}}；reader state{readIds,uninterestedIds}；收藏身份可独立于可过期material cache解析。

.nand/config/settings.json 的 news namespace保存sources、模板、权重、视图、显示/目录；绝对CLI目录/agent偏好可device scope，cwd优先存vault relative、执行canonicalVaultCwd。全部设备state在.nand/news/<device-id>/{materials,analyses,events,heat,runs,reader-state}.json，version envelope，JsonStore，默认30天，仅删可重建缓存且保留引用需要的最小identity。可选结果文件.nand/news/<device-id>/runs/<runId>/result.json，不默认使用。不得读取失败就以空值覆写，不另造备份系统。

用户Markdown默认NAND/新闻/收藏/YYYY-MM-DD-<安全标题>.md，frontmatter nand-type: news、stable id、url、source、published、score、tags、event，正文标题/摘要/理由/原文链接/我的批注；日报NAND/新闻/日报/YYYY-MM-DD.md，简报NAND/新闻/简报/…。中文路径不随界面语言变更；重复写采用稳定身份/管理区域，用户批注和未保存编辑不覆盖；更新只在耐久写成功后显示saved。.nand不经Obsidian Sync同步；手机读Markdown，不声称设备JSON共享。无已有news数据迁移，旧home board实例兼容由home registry owner负责，新增news widget实例遵循它的schema而非新格式。 AGENT_PROMPT_RUNNER另支持可选runContext:{provider,handle}，AGENT_RUN_CONTEXTS贡献点仅由受信模块注册resolver，将opaque handle转换为短期env与dispose；不接受任意用户env，不保存或日志输出env/token。provider缺席/句柄失效在启动前拒绝。resolver在实际runId/cwd就绪后解析并绑定，finally/取消/卸载一定释放。news普通分析不传runContext。这是既有contribution机制中的小型执行上下文端口，不新增进程管理器或调度器。 短期runContext env只能在最终host.create/spawn合并，不能混入accountEnv、accountKey、持久session/history、hook配置或receipt；保持现有账户身份算法。即使keepTerminal=true，业务完成/取消/timeout也立即dispose授权，不能随终端保留。

## 8. 非功能要求

- **NFR-001**：安全：材料含prompt/JSON/角色命令都不可信，提示词分区和id/target白名单；不执行feed HTML、不过CLI权限、不默认YOLO、不保存模型密钥；结果文件受用户选择和vault路径约束。
- **NFR-002**：性能：manifest/api数据仅startup，module与UI lazy；startup预算不扩大，news独立activation预算；网络有界并发、AI串行，保留天数和按需分页，不新增数据库/队列。
- **NFR-003**：可靠性：运行前receipt、返回先保存、一次格式修复、无未知重复花费；关闭仅清理自有资源；JsonStore保存失败不报成功；单源错误局部状态。
- **NFR-004**：可观察性：每源健康/下次抓取、每批状态/耗时/usage/错误/打开terminal，unknown usage/coverage明确；支持矩阵区分实测与未测；所有用户文案en/zh。
- **NFR-005**：可用性：Preact、现有tokens/primitives，真实按钮/键盘/focus-visible，32px桌面44px触控；三宽度/深浅/三preset，禁动画偏好，元素window支持popout。
- **NFR-006**：工程：zone matrix全含type imports，跨module只api，Node仅desktop，module.ts不静态ui；必要算法/format/runner契约tests，不镜像实现堆测试；main.js/styles.css与源同步。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-002, AC-003, AC-004, AC-005, AC-021 | 新增co-located src/modules/news/core/materials.test.ts、source-schedule.test.ts、platform/feed-reader.test.ts 后运行 pnpm vitest run src/modules/news test/golden/user-formats.test.ts；golden先例 test/golden/user-formats.test.ts。; pnpm vitest run src/app/modules/registry.test.ts src/app/settings/module-switch.test.ts src/app/settings/nav.test.ts && pnpm test:i18n && pnpm test:architecture; 真实Obsidian测试vault启用news→设RSS/Atom/JSON源→试抓→刷新→收藏→编辑批注→再刷新→关/开。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-006, AC-007 | pnpm vitest run src/modules/automations/automation.test.ts src/modules/agent/platform/desktop/hooks/native-extensions.test.ts src/modules/agent/core/history/parse.test.ts src/modules/agent/services/prompt-runner.test.ts src/modules/agent/platform/desktop/history/last-assistant.test.ts；仅针对新增runner状态/完整答案读回补co-located风险用例。; 在测试vault分别以Claude/Codex真实账号发送含多条JSON任务并读取>8000字符有效结果；另验证Gemini/OpenCode/Pi/Grok真实能力并记录未测项。; 真实Obsidian权限等待→打开终端，手动取消、10分钟可调测试超时、news/agent关闭、缺helper/CLI。; 定向prompt-runner seam用provider分配临时标记、抛错/timeout/cancel与重复handle，再检查spawn argv/env/receipt | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> |
| T-03所列稳定入口 | 真实host/系统集成或定向单元 | AC-008, AC-009, AC-010, AC-011, AC-012 | 新增co-located core/scoring.test.ts、analysis.test.ts、services/analysis-service.test.ts（服务先例src/modules/notifications/core/service.test.ts），运行 pnpm vitest run src/modules/news。; 测试vault设置12条材料/每日预算2，刷新→看到精选/全部与维度→改权重→尝试第3次调用→重启未知批次。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path> |
| T-04所列稳定入口 | 真实host/系统集成或定向单元 | AC-013, AC-014 | 新增core/grouping.test.ts、representative.test.ts，运行 pnpm vitest run src/modules/news/core。; 测试vault导入官方发布、先发爆料、媒体转述、后续评测、两个独立发布的合集；查看折叠、进展和旧event深链。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path> |
| T-05所列稳定入口 | 真实host/系统集成或定向单元 | AC-015, AC-016, AC-017 | 新增core/heat.test.ts后 pnpm vitest run src/modules/news/core/heat.test.ts。; 真实Obsidian使用有缺口的7日fixture，查看24h/3d/7d、左右/esc点选、小屏深浅和reduced-motion。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path> |
| T-06所列稳定入口 | 真实host/系统集成或定向单元 | AC-018, AC-019 | 新增core/edition.test.ts、views.test.ts后 pnpm vitest run src/modules/news/core test/golden/user-formats.test.ts。; 在两个workbench分屏选不同view/新闻，重启恢复，再改筛选、保存view、打开今日并观察runner调用计数。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-06.md</Path> |
| T-07所列稳定入口 | 真实host/系统集成或定向单元 | AC-020, AC-022, AC-026 | 补co-located src/modules/news/services/news-service.test.ts 的brief流程失败/幂等场景及platform/notes.test.ts的管理区/批注边界，再运行 pnpm vitest run src/modules/news src/modules/notifications/core/service.test.ts src/modules/automations/automation.test.ts test/golden/user-formats.test.ts。; 事件详情点击深入了解→真实CLI完成→查看Markdown→原文→选现有Agent接收；失败重复notify→点开。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path> |
| T-08所列稳定入口 | 真实host/系统集成或定向单元 | AC-023 | 补co-located src/modules/news/contrib/home-widgets.test.ts，运行 pnpm vitest run src/modules/news/contrib/home-widgets.test.ts && pnpm test:architecture && pnpm run check:bundle；消费home registry已有contract，用最小案例验证news贡献配置独立、只读不启模块和dispose注销。; 真实Obsidian同board放热点和两个不同saved-view实例，改一份config→点击条目→news off/on。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path> |
| T-09所列稳定入口 | 真实host/系统集成或定向单元 | AC-024, AC-025 | 新增platform/opml.test.ts、web-list-reader.test.ts后 pnpm vitest run src/modules/news/platform。; 测试vault导入含重复源OPML、导出重导；配置一个公开静态列表的selector→preview→refresh；再用无匹配selector。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-09.md</Path> |
| T-10所列稳定入口 | 真实host/系统集成或定向单元 | AC-027, AC-028 | pnpm run build && pnpm run lint && pnpm run lint:css && pnpm test:i18n && pnpm test:docs && pnpm test:architecture && pnpm run check:bundle && pnpm vitest run src/modules/news src/modules/agent src/modules/automations src/modules/notifications test/golden/user-formats.test.ts; 按 .agents/skills/dev/references/testing.md 使用新disposable vault运行 scripts/obsidian-acceptance/workbench-fresh-runtime.mjs；真实helper，记录截图，验证restart；另做Claude/Codex真实账号与手机Markdown阅读。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-10.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- 真实Claude/Codex账号与其余CLI能力是执行事实验证门，不能以静态阅读代替；T-02保留真实版本/账号输出证据和支持表。
- 六CLI transcript/argv能力不一致且hook有字符与UTF8双上限；能力驱动单通道、受测批量上限、completion元数据独立于全文。
- AI合批/输出axes相对AIHOT独立分步会改变品味；少量标注样本对照，不声称模型等价，不建过度benchmark平台。
- 事件若无occurrence层会使ROUNDUP桥接与日报/代表错误；保留最小内嵌层级与确定关系fixture。
- 新源/落后采集虚增趋势；cohort和缺失小时显式，拒绝0填充；本地不等于24/7监控。
- home registry/Agent公共contract并行领域冲突：由home拥有公共基础，本change依赖具体契约票，后续current串行执行。
- 原issue版本及路径过期，#135是否已解决需终端领域真实下载验收；不能盲修旧版本假设。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
