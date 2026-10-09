本工件由G拥有，记录实际研究证据。研究过程中的建议以本change最终ADR与Spec为准；例如新闻后段功能全部保留、首页三项日期/主题/直发语义、浏览器五阶段及数据边界均已由用户明确确认。文件路径是导航，不是源码移植授权。临时研究检出不作为恢复依赖，恢复须按固定SHA/公开URL读取。

# #136 新闻模块研究回传

- Caller / owner：G-grill-with-docs，根代理拥有 `<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/LOG.md</Path>`（研究可由 caller 拆出 `reference-analysis.md`；`CONTEXT.md` 只存术语）；本文件仅为 `/tmp` 研究回传，不是 Speculo state，不实施代码、不修改 issue。
- Decision：如何在 NAND 现有模块/Agent/工作台/存储契约下完整交付 #136，并准确继承 AIHOT 的选题、归组、热度与阅读体验。
- Questions：① #136 全部能力/阶段/非目标是什么；② 上游算法与 UI 真正怎样实现；③ 当前 NAND 可复用边界、旧引用与缺口；④ 哪些差异必须明说；⑤ 可执行 AC、纵向 tickets、依赖与最小验证。
- Scope/version：issue 全文 `临时研究检出/136.txt`；NAND 当前 HEAD `1b9121382363cc50254fbc973c24742b7742edc7`；issue 的旧 NAND 基线 `21f852bc2d91d60335f57a4bc38a1e663e8b05eb`；AIHOT 固定 `c547b669acc7f64720cd82024e502446ee1ef88d`（实际 clone 的 latest 是 `59c8c814…`，主动切回 issue 固定提交，未把 latest 混进证据）。源树 `临时研究检出/AIHOT`。
- Stop condition：全部需求映射，全部第 3 节规则有源函数与 NAND 落点；运行验证未知明确进入 ticket，不把静态阅读写成已验证。
- Method：dev/ui skills、architecture/module-authoring/settings-i18n/licensing/testing、ui shell/design-system/motion-a11y、research skill 已读；AIHOT 源码固定提交直接阅读；许可证和 feed 标准另经官方网页校验。64 个 issue URL 存于 `news-issue-urls.txt`，旧/新 NAND 路径比对存于 `news-linked-path-audit.md`。没有运行模型、真实账号、Obsidian 或付费采集。

## R-001 — 必须保留的完整产品范围

类型：issue 事实；可信度高；限度：issue 的“待定/后续”必须由最终 Change 明确边界，不能假装已决。
来源：[issue #136](https://github.com/NAMEWTA/nand/issues/136)，全文第 1、5–10 节。

1. 新增 `news` 模块，开关、图标轨入口、工作台页面、侧栏、设置分类；与 AI Agent 页同级。
2. 采集 RSS、Atom、JSON Feed；信源 CRUD、启停、试抓、分级 T1/T1_5/T2/不精选、editorial/signal/isolated、参与方归属组、间隔、健康状态；URL 身份判重、内容哈希修订、首次存量/48h 旧文归档、自适应抓取及失败退避。
3. AI 只复用现有 Agent CLI 程序调用，不能另接模型 API，也不能在自动化中心伪造定义或 `AutomationRun`；已有 CLI 账号/目录信任/权限/hooks 原样接入。
4. 一次性提示词 runner、完整结果回读、总超时、取消、等待权限可打开终端、成功默认关闭专用终端、可保留；每批串行、批次可配置、按字符/实际传输限分批、一个 JSON 结构、最多一次格式修复、错误状态可理解。
5. 五维×7 类权重、分级门槛、精选/全部、写作下限、编辑/恢复提示词及版本 hash、兴趣画像、程序屏蔽词、分类表/标签白名单；可选两次独立评分；缓存/收据/调用次数预算/用量/重启不自动重放。
6. 14 天候选召回、字符二元组、四种关系、置信度、事件合并、代表稿、48h 热度及趋势/角标、小时快照/7 天曲线。
7. 阅读页面：精选/全部/热点/今日要闻/收藏/信源/运行记录；列表同一事件或发生折叠；详情中文标题摘要理由、分数及五维、分类标签、来源时间、同事件其他报道、可正倒序的时间线；原文打开、收藏、发给 Agent、不感兴趣。
8. 视图 + 分类/标签/信源/最低分/关键词筛选 + 保存“我的视图”；对条目/事件“深入了解”调用 runner 生成背景/影响/时间线简报，写 Markdown 并在详情展示。
9. 首页 3 类型小组件：热点 Top N、精选流、指定我的视图；多实例独立设置条数/视图/摘要/刷新阈值；显示更新时间、刷新与分析进度；条目深链到详情、标题到新闻页；关闭 news 后占位保留配置，不顺便启动 news。
10. 收藏 Markdown 默认 `NAND/新闻/收藏/YYYY-MM-DD-<标题>.md`，frontmatter `nand-type: news`、url/source/published/score/tags/event，正文标题/摘要/推荐理由/原文链接/我的批注；用户批注不得被再刷新覆盖；今日要闻可选写 `NAND/新闻/日报/YYYY-MM-DD.md`，简报写 `NAND/新闻/简报/…`；插件删除后仍可读。
11. P5 明列 OPML 导入导出、网页列表信源、两次评分、7 天曲线、`docs/news.md`。前四项应有后段 tickets；手机只读在 issue 中“待定”，不得未经决策宣传完整移动新闻支持。
12. 所有设置在新闻分类、en/zh 文案、工作台保存 `stateKeys/getState`，分屏/重启恢复；模块关闭取消自有运行/监听/定时器/DOM；检查构建、lint、CSS、architecture、预算；真实 Obsidian 深浅色/三宽度/键盘。

明确非目标：服务端/Postgres/队列、公开站/API/RSS/MCP 输出、后台、直连模型 API/保存模型密钥、X/微信/Jina 付费源、向量检索、cron/自动化中心定时定义、默认开启 YOLO、自动全文转载、在 news change 重做 home。

## R-002 — 许可与源代码复用边界

类型：official/code fact；可信度高；限度：这里只证明当前固定提交声明，未来依赖另行检查。

[AIHOT LICENSE](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/LICENSE) 是 MIT，版权行为 `Copyright (c) 2026 数字生命卡兹克`。[NOTICE](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/NOTICE) 排除 AIHOT 名称和 Logo，另列字体 OFL、新闻内容仍属于发布者。不存在阻止自主重写算法/交互的源码许可障碍；不得搬品牌/字体/新闻全文。

NAND `.agents/skills/dev/references/licensing.md` 要求改编代码、提示词或算法：源文件头记项目/许可证/完整上游 SHA，更新英文 `NOTICE`，保留上游 license，新增 `docs/third-party/aihot-news.md` 与 `.ZH.md` 文件映射。若只在研究文档引用而未交付改编，不提前宣称 main.js 已含 attribution；实施 ticket 同步办理。不把 AIHOT React Router、Tailwind、z-index 字面量、global document/window 或 logo 搬到 NAND；本项目用 Preact、现有 primitives/tokens、元素所属 window。

## R-003 — AIHOT → NAND 规则对照（固定 SHA 见上）

所有 NAND `src/modules/news/…` 都是**拟新增**路径；其余是已有路径。

| 能力/规则 | 实际上游来源 | 必须保留的行为 | NAND 拟落点/有意差异 | 最小验证 |
|---|---|---|---|---|
| 处理流程与页面只读 | `docs/architecture.md`；`editorial/analyze.ts:410 runAnalysis` | 采集→预筛→评分/结构化→写作→归组→可见→榜单/日报；浏览读取已算结果 | `services/news-service.ts` 编排，UI 仅订阅读模型；设置授权的 stale-refresh 由 service 触发 | 打开同数据多个视图只创建 1 个刷新；渲染自身不调用 CLI |
| 预筛与材料不足 | `industry/prompts/prefilter.md`；`analyze.ts:217 waitsForPage, :410` | PASS/BLOCK/UNKNOWN；只有标题不足以编写正文；BLOCK 隔离，UNKNOWN 不等于无关 | `core/prompts.ts` + `core/analysis.ts`；原始列表仍可显示状态；未拿到材料不捏造分析 | 有标题无证据 fixture 不出现精选/伪摘要 |
| 七类五维与压分 | [selection-score.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/industry/prompts/selection-score.md)（含末尾“事件口径校正”） | 7 类、sig/nov/cred/reson/act 各 0..10 整数；评分不提供 tier/源名/first-party；例行更新/营销/预告等压分；评价事件，不奖励稿件长度/品牌 | `core/scoring.ts`, `core/prompts.ts`；模型输出 axes，程序按权重算，和上游只返回 attentionScore 有明确差异 | 固定 axes×7 权重、边界、错误拒收；用少量标注样本核对轴输出改动，不能拿程序单测声称模型品味一致 |
| 双评分与精选门槛 | `analyze.ts:48 SCORE_CALLS, :437 normalizeAnalysis`；`industry/selection.ts` | 2 次分数和 ≥2×tierThreshold，展示 floor 平均；60/65/76；未列 tier 不精选；understandFloor 是**严格高于**50 | `core/scoring.ts` 支持 sampleCount 1 或2、持久化原始 axes；默认1、可选2，且两次来自独立调用，不让一次输出2个分数假冒独立 | [59,61] T1 可选；[59,60] 不可；50 不越 understandFloor；2 次实际预算 |
| 结构化 | `industry/prompts/structure.md`; `analyze.ts:164 normalizeStructure` | category/tags/subjects/scope/fact；single/composite/unknown；事实主体动作对象时间；composite 无自有 fact；不能把旧发布背景当新动作 | `core/model.ts` 分析保留 scope 和 occurrence/frame；issue 简略 JSON 必须补这些字段才能兑现下游规则 | 多事件回顾不被当独立发布；“今天讲上周发布”不复制上周 action |
| 标题摘要与理由 | `industry/prompts/content-understanding.md`；`analyze.ts:338 runUnderstand` | 中文标题自洽，先事实后细节；理由基于本材料；不编新名字/数字/阶段；不足时允许无理由 | batched 输出合并结构化与写作，但评分输入隐藏来源 tier；页面区分原始与 AI 文案 | 一份简报包含真实引用链接；正文摘要不可扩写未知事实 |
| prompt 版本 | `editorial/prompts.ts:71 promptVersion` | hash 包含引用的子模板，不只主文件；缺变量/文件报错 | `core/prompts.ts` 对全部有效模板+影响分析的画像/分类等形成版本；旧已完成不因改模板自动重跑 | 编辑→新材料新版本；旧结果原版本保留；权重改动不触发调用 |
| URL identity | [url.ts:8 normalizeUrl, :54 identityKeyForUrl](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/lib/url.ts) | http/https、host 小写/no www、no fragment、追踪参数清除/排序、默认端口处理；微信专用 id、X post id（这些入口首版不采） | `core/materials.ts`：保留原始 URL 用于打开，另算 canonical identity。修正上游带 query 的路径尾 `/` 漏去问题；网页列表 anchor 源显式 preserveFragment | `a/b/?x=1` 与 `a/b?x=1` 合一；保留业务参数；两个 release anchor 选择 preserve 时不合一 |
| 内容修订 | `content/materials.ts:121 contentHash, :164 upsertIn` | whitespace normalize 后 title/body/excerpt 用 U+0001 分隔 sha256；相同 hash 不重算；已见旧 hash 不来回重算 | `core/materials.ts`、`platform/store.ts`；无需照搬 SQL 锁，但单 service 写入序列维持身份 | 追踪参数不新建；改正文1修订；重复抓取0AI |
| 时间与旧文 | `materials.ts:68–116 decideTimeline/isHistorical`；`sources/collect.ts:113,170` | 首次导入归档；发现时 >48h 归档；无可靠日期/未来>1h 不当今日；后续不滚入更旧存量 | 保存 claimed/published/discovered/timeline/backfillReason，按本机所选时区显示；未知发布时间可在全部列表标记但不热度/今日 | 精确48h与48h+1；未来日期；首导年轻文章不进今天；补日期不把发现时点改成当前 |
| RSS/Atom | `sources/rss.ts:18 parser, :170 fetchRss` | RSS/RDF/Atom、HTML/CDATA/plain/XHTML、xml:base/redirect base、alternate link、日期；ETag/Last-Modified、配置hash变化重抓；存储成功后提交 cursor | `platform/feed-reader.ts` 用 requestUrl；解析以结构化纯数据交给 core；不搬 Node fetching/cheerio/fast-xml-parser 依赖除非实需 | RSS2/Atom各真实规范 fixture；相对链接；304 0新增；失败不推进成功 cursor |
| JSON Feed | AIHOT `sources/json-list.ts:147` 是通用映射 JSON，并非标准 JSON Feed | #136 要标准 JSON Feed 1/1.1；id稳定，date_published、authors、content_text/html | 自己按 [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) 做 `platform/feed-reader.ts`；不要叫 json-list “JSON Feed 支持” | 相同 feed-id 更新；title 可缺但 content 必须有；invalid item 局部跳过并报告 |
| 自适应间隔 | `sources/collect.ts:380 adaptIntervals` | 7天非backfill条数/7；≤0.15取上限；round(clamp(1440/(daily×3),15,60))；signal 180；付费120及Jina最小60不在本轮 | `core/source-schedule.ts` 只调到期，单源失败隔离；signal cap可沿用180；设置普通源默认15–60 | 0、0.15、活跃样本；全局刷新不强刷所有未到期源 |
| 退避/健康 | `collect.ts:80 recordFetch` | prior fail_count+2 × interval 上限360；5连续失败 failing；成功清零；源落后 grace=max(3×interval,90) | `core/source-schedule.ts`+侧栏健康；进度用文字/图标，不仅红色 | 第1次失败2×interval、成功重置、一个源失败其它成功 |
| 候选召回 | [recall.ts:19,126,164](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/recall.ts); `relate.ts:194` | discovery 最近14天；标题+摘要前300；字符二元组 intersection/min sizes；lexical门槛0.25；每fact最佳report去重，前10 | `core/grouping.ts`；无 vector/API，0.6/0.85 cosine不可误套到lexical；旧已选不具fact只作阅读上下文，不当身份证据 | 字二元组确定样本；同fact多稿仅一个candidate；composite不桥接 |
| 关系与合并 | `group.ts` 文件首注释与 `judgeBatch/confirmMerge`；`relate.ts:174,186`；`industry/prompts/group-definitions.md` | SAME_OCCURRENCE/ SAME_STORY /UNRELATED/ROUNDUP；tie≥0.8；合并复核≥0.75；SAME_STORY 直接关联根发生，不靠链式漂移；ROUNDUP只mentions | Event 嵌 occurrences；成熟 spec 不可只 Material→Event；批内材料也互相成为候选避免同批重复开 event；低信心保留未确认，不自动精选 | 同产品独立新发布不并；预告→正式发布同story不同occurrence；综合稿连接A/B不合并A/B |
| 代表稿 | [representative.ts:15,33](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/publication/representative.ts)；`hot.ts:194` | 先确定报道源最多的 occurrence，平手较早；该fact内T1优先、owner与subject匹配的机构/个人、全文、分数、早时、stable id | `core/representative.ts`；需要 Source.ownerEntity/publisherRole 与 Analysis.subject，不能只有group；未验证不冒称官方 | 泄漏先发不得抢正式发布；同机构别的事件不得凭身份抢代表 |
| 参与方 | `hot.ts:113 currentSignals` | community按作者、signalGroup、ownerEntity、source依序；同公司多个渠道1参与方；isolated/withdrawn/非事实editorial不计；设置修改立即重算 | `core/heat.ts`，Source participant配置可表达 author/group/owner/source；不把信源数=参与方数 | 同源10稿=1；同owner多源=1；两个作者=2；设置变化重算 |
| 热度 | [hot.ts:138 heatRows, :179 heatIndex, :183 ranking](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/hot.ts) | 48h内每参与方最后原文时间，sum 0.5^(Δh/24)；窗口下界开上界闭；heatIndex=round(raw×100)/10；≥2参与方且≥1editorial；前10，同heat最近 | `core/heat.ts`纯函数、设置参数；原文时点缺失不伪造近期heat | t=0和24h参与方 raw1.5/显示15.0；重复稿不增长；正好48h不入 |
| 趋势和角标 | `hot.ts:218–238` | 比6h前各自48h；剔除落后/窗口开始后新增源的参与方；prevAll≤0 new，无可比 unknown，>10% up/<−10% down；surge≥3新参与且≥50%；首报<6h new；非surge且>15% rising | `core/heat.ts` 保存 cohort/coverage；不要把 up10% 与 rising15% 混成一个阈值 | late source不能制造涨幅；prev0 new；有旧heat无可比unknown；10/15%等于边界不算超过 |
| 小时曲线 | `hot.ts:288 snapshotHeat, :310 heatSeries`；`features/story/HeatChart.tsx` | 7天、可比cohort、未完整小时缺口、少于3观测点不画，补齐源后重算不完整；24h/3天/7天可选 | `core/heat.ts` + `ui/HeatChart.tsx`；本地仅运行时记录，未观测小时明确缺口，不捏造完整24/7监控 | 断小时不连成0；新源加入不造成虚假jump；键盘左右选点 |
| 今日要闻 | [edition.ts:289 importance, :299 dailyEdition, :379 arrangeDaily](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/reports/edition.ts) | (score??50)+5log2(1+participants)+官方5−followUp6；每事件1条、12正文/10快讯/每源2；7期记忆；旧事件新事实当事方动作或≥4源才正文；roundup挂最重要事件；无精选但官方+≥3独立参与可补日报 | `core/edition.ts` 程序编排不AI；本地“今日”取设备时区日界或固定cutoff必须定明；issue未要求周月报 | 固定样本公式/源上限/7日记忆/官方补入；重新打开页面0AI |
| 日报特例/周月报 | `edition.ts:400 full`；`:167 periodEntries` | 上游全为跟进时仍允许正文；周/月rank=maxscore+5log2(1+maxsources)+lead6+highlight3+4(days−1)，模型只总述 | 建议保留全跟进特例并写差异；周月报仅研究对照、作为明确非本轮交付（issue实施/AC只今日） | 日报特例单fixture；周月不产生空壳入口 |
| 请求收据/预算 | `providers/receipts.ts:84 logicalKeyFor, :97 checkBudget, :122 paidRequest` | 请求前持久化，原始结果先存再消费；每次实际发送含retry计预算 | `services/analysis-service.ts`+`platform/store.ts` 轻量run receipt；材料hash/prompt/agent(+账户身份，避免混账号)/阶段sample决定key；重启未知不自动重放；不搬pg-boss或30min自动放行机制 | crash边界用一项服务契约测试；完成结果重用；修复/双评分都占调用额 |
| 阅读UI | `routes/home.tsx/all.tsx/hot.tsx/story.tsx`, `features/feed/FeedItem.tsx/ReadingGroup.tsx/Timeline.tsx` | 日分组、桌面时间rail卡片/窄屏紧凑行、标题摘要理由层级、分数标签、重复稿展开、热点排名+趋势+参与者、详情overview+developments+reports+heat | NAND ②栏承载导航过滤，③栏读内容；用NAND tokens/Preact，不再造AIHOT站点侧栏router或phone sheet系统 | 三宽度、两色+三preset真实Obsidian；读组键盘展开；分屏状态隔离 |
| 收藏/已读 | `apps/web/app/lib/local-state.ts` | 上游localStorage收藏500/已读5000、同页和跨页通知、保存失败可见 | NAND 收藏必须可见Markdown，已读/不感兴趣可设备state；不拷贝500/5000任意上限；缓存清理不删除笔记 | golden往返+手写批注保留；删除缓存后收藏仍列出 |

## R-004 — 上游精读后的冲突/遗漏（不能照 issue 概括抄 spec）

类型：code fact + inference/recommendation；可信度高（行为推断必须实测）。

- **Event 草案少了一层**：AIHOT 把同一次发生叫 fact，后续进展集合叫 story。#136 草案仅 Event/material+relation，若不保存 occurrence 身份，就无法实现“报道最多的事实”代表稿、日报新进展、ROUNDUP 非桥接；建议 Event 内嵌 occurrences，而非新数据库/复杂图引擎。
- **双评分**：issue 第3节说保留，第7节默认关、第8节P5列“后续”；最终范围可支持但默认关。一次JSON里返回两个分数并不独立。第二次只评分且不提供第一次结果，额度计2。
- **UNKNOWN**：上游预筛 UNKNOWN 会继续分析；normalizeAnalysis 最终因有效写作可得到 pass。不要把 UNKNOWN 一律BLOCK，也不要无证据的标题强写摘要。spec 应区分 prefilter label 与 normalized relevance。
- **权重改动即时重排 vs 压分**：若只保存axes，标题正文不符的总分≤30规则可能被用户换权重打破；建议保存可解释 `scoreCap`/quality flags（仅对明确规则），或在spec明确压分约束随权重重新应用。不要只在prompt里“心算总分”而忽略程序得分。
- **评分不看source与合批**：全批次提示词若带source名称/tier及候选原文，模型能够看见这些。建议评分材料段只含匿名id/标题/正文/原文时间，不传tier；tier/owner只由程序用于门槛/代表稿。写作/归组需要来源上下文时使用独立段、字段，记录与上游隔离调用的差异，不声称完全无来源偏差。
- **JSON Feed不是通用 JSON列表**：上游`json-list.ts`不足以当标准实现。RSS/Atom 需正确处理 plain text/HTML/XHTML、xml:base；只用正则抽link/title不是合格实现。
- **URL 尾 slash**：AIHOT只在URL序列化整体以`/`结束时去尾斜线，`/a/?q=1`保留。#136 AC 要链接别名合并，NAND应规范 pathname 而不是复刻这个缺口。文章原链接独立保存；canonical升级不修改打开原文地址。
- **抓取不足不等于“热度下降”**：cohort/unknown必须进入数据与UI。缺观测小时不是0；只记录新闻页打开时会严重缺口，建议由模块在 Obsidian运行且已启用时的小时边界/每次刷新存快照，但不为曲线启动额外AI或网络。
- **日报**：issue仅概括门槛，源码有官方+3参与补入、composite挂载、全跟进日允许正文；必须映射。周/月公式要求“研究对照”不自动等于要交付周/月 UI，可明确暂不做。
- **首页依赖**：当前没有注册表；若同批计划 #134，优先依赖该注册表 ticket。不要同时造临时HOME_WIDGETS又马上迁移，除非明确改变交付次序。
- **关闭news占位**：仅由news active贡献renderer时，禁用会撤销贡献；home必须能从持久化kind/instance拿到未提供renderer的占位，不能要求news维持活跃才能占位。news数据服务`peek`不得启用模块。

## R-005 — 当前 NAND 真实落点与旧引用

类型：repository code fact；可信度高；baseline 已固定；没有 runtime验收。

| 当前路径/符号 | 事实/影响 |
|---|---|
| `src/modules/agent/api.ts` | 仅 `AGENT_SESSIONS`/`AGENT_WORKBENCH`，没有 prompt runner；新接口归此文件，不能 news import services internals |
| `src/modules/agent/services/agent-runtime.ts:49 automationArgs` | 现有6CLI全部argv/flag：Claude/Codex/Pi位置参数，Grok前`--`，OpenCode`--prompt`，Gemini`--prompt-interactive`；issue旧“首次粘贴等20s ready”已移除 |
| `src/modules/agent/core/launch/catalog.ts` | `AGENT_CATALOG` 当前唯一目录；旧`automation-catalog.ts`和`CORE_AGENT_IDS`都不存在，不得把这些旧符号写进实现ticket |
| `agent-runtime.ts:216 start` | 需完整 `AutomationRun`；校验CLI启用/安装、真实vault cwd、现有YOLO确认；prompt runner应抽取共享执行入口，由automation adapter传自己的run，news不制造automation记录 |
| `agent-runtime.ts:175–191 receive` | last_assistant_message尾8000 chars；只处理 start/stop，对PermissionRequest不处理；status成功不代表有完整文本。开放完整输出需新runner契约，不随便改变自动化摘要截断行为 |
| `agent-runtime.ts:380` | output尾8000带ANSI，不得作为新闻JSON回读渠道 |
| `platform/desktop/hooks/automation-hooks.ts:28` | stdin超过65536 JS字符静默退出（不是清晰oversize事件）；`:poll`文件>100000 bytes拒读后删除；中文UTF-8不能只看chars。扩展应保证completion元数据独立于大文本，或以transcript读取；保留有限容量且给明确错误 |
| `platform/desktop/hooks/native-extensions.ts` | Pi发session_id/transcript_path/cwd，OpenCode只session_id/cwd；都不发last_assistant_message；OpenCode发PermissionRequest；不能宣称它们都已有transcript_path |
| `core/history/parse.ts` | Claude/Codex/Gemini只解析cwd/sessionId/title/messageCount，完全没有最后assistant答案；需明确新增reader，不只是调用现有parser。Pi/OpenCode/Grok仍需各native adapter验证 |
| `agent-runtime.ts:197 sessionUsage` | 只有用量读取10s timeout，不是总运行超时；无总run deadline；结果usage unknown不得伪造0成本 |
| `agent-runtime.ts:428 stop` 与 `services/controller.ts:478 dispose` | stop移除terminal和hook；controller dispose统一sessions；news关闭仅取消自己终端，agent关闭中断runner；正常成功CLI交互进程仍活着，runner需默认stop。keepTerminal允许调试但news disable仍必须清理自有进程 |
| `src/modules/agent/module.ts`, `manifest.ts` | agent 提供 `AUTOMATION_AGENT_RUNTIME`（key定义在automations/api.ts，owner仍agent），新runner在agent services/provides注册 |
| `src/shared/automation/types.ts`, `modules/automations/core/service.ts:309` | automation持久化run后start，保留其契约回归；共用`AgentUsage`类型可保留shared位置，不为“通用化”无关迁移整套automation |
| `src/modules/home/api.ts` | 只有BoardOperations/Surface/HomeWorkbench服务；没有贡献入口 |
| `home/ui/renderer/render-sidebar-widgets.ts:179`；`home/core/board/types/model.ts:418` | WidgetEntry硬编码，CardType封闭。新news widget不可塞进hard-coded switch；通过#134新增registry |
| `src/modules/notifications/api.ts` | send支持幂等id、title/body/channel；target是automation形状。news无须伪造target，可 `news:<runId>:<outcome>` id + `NOTIFICATION_OPENERS`解析归属，必要时最小typed metadata扩展，非重构整个通知 |
| `src/modules/browser/api.ts` | `BROWSER_OPEN`打开原文，关闭时系统浏览器；只有点击触发，不加载新闻触发 |
| `AGENT_SESSIONS.attachMaterial` | 把标题摘要链接送会话输入框，不自动发送 |
| `src/shared/json-store.ts` | validated load、threeWayMerge、写队列、backup/corrupt、load失败阻止save；直接复用，不新造双写/多重恢复框架 |
| `src/app/contracts/module.ts:8`、`app/manifests.ts`、`settings/app-schema.ts` | 添加news id/manifest后开关生成；建议defaultEnabled=false（dev规则：remote/process模块默认关），activation on-demand/layout-ready选其一并说明startupRefresh如何启动 |
| `app/contracts/workbench.ts`、`app/workbench/compose-workbench.ts`、`shell/navigation-state.ts` | 添加news feature/owner/sections/availability/panel/stateKeys；仅两view types，不新router |
| `app/settings/nav.ts`、`app/workbench/settings-categories.ts` | 新闻product/nav/icon；namespace bind而非saveData；启动读取title keys在shared i18n，其余news/i18n；scripts/module-strings.ts注册 |
| `manifest.json`/`package.json` | 当前版本都是`0.0.1-alpha.1`，#136里main 1.0.0已过期。#135先修终端组件的验收依赖仍保留，但是否现已修不能用旧issue静态断言，由release研究/真实下载探针判定 |

拟新增目录应遵守：`core`纯模型/算法/解析契约；`platform` Obsidian requestUrl、vault IO、Markdown read/write；只有Node/Electron部分才置`platform/desktop`。调用agent服务是`services`编排经`agent/api.ts`，不是news `platform/desktop`另做进程。`module.ts` lazy UI，`contrib`只贡献类型/loader；可把widgetUI以动态import延迟加载，不能经contrib静态拉入news/ui违反import matrix。

## R-006 — 建议写入成熟 spec 的状态、数据与默认值

类型：recommendation，区别于既定要求；根代理应记录决定与未知。

### 模型与状态

- `SourceConfig`（vault设置）：id/type/url/tier/mode/participant策略/owner/publisherRole/interval/enabled/可选网页列表selectors；`SourceHealth`（device运行数据）：lastAttempt/lastSuccess/failureCount/nextDue/initializedAt/ETag/LastModified/configHash。
- `Material`：id、sourceId、sourceItemId、originalUrl、canonicalKey、originalTitle、bodyExcerpt、author、publishedAt与claimedAt、discoveredAt、revision/contentHash、backfillReason；抓取同一个identity只更新material，不自动改已收藏笔记。
- `Analysis`：materialId/revision/hash、effectivePromptVersion、agentId/accountIdentity、sample axes、type、质量cap、relevance/selection reason、scope、category/tags/subjects、titleZh/summaryZh/reason、frame、createdAt；派生score/selected可重算，不以UI缓存为权威。
- `Event`：id、occurrences（id/frame/primary reports/follow-up relation）、roundup mentions、representative、first/latest、merge alias；不做通用知识图谱。合并保留old id→new id让收藏/深链不失效。
- `HeatSnapshot`：event/hour/value/participants/cohort/complete/ruleVersion；保存不完整状态；历史窗口内算法设置变更可从仍有信号重算；不凭空补历史。
- `NewsView`：stable id/name/filter；收藏身份用canonical/source item，不依赖可能被30天缓存清掉的material id。
- `RunReceipt`：run/batch ids、trigger、material revision ids、promptVersion、agent、attempt/sample、requestedAt/startedAt/endedAt、state、full raw output locator/hash、usage known/unknown、error、terminalId。
- 状态分开：refresh(fetching/analyzing/finished/partial/failed/cancelled) 与 batch(queued/running/needs-attention/received/committed/failed/cancelled/timeout/interrupted/budget-exhausted)。输入JSON失败明确failed，缺id材料retryable，未知id丢弃并记录数量。
- 一次修复只针对格式，不能自动换模型、多provider回退、无限重试；结果文件为用户选择渠道，默认不用来绕过CLI权限。按CLI能力选hook或native会话读取，别形成3层猜测fallback。
- 未启动queued材料可下次显式刷新继续；已启动结果未知interrupted不能被stale refresh自动花费重放；运行记录提供明确重试。启动前run receipt耐久化、收到结果先保存后解析/应用，可重启继续消费已收到结果而不重叫CLI。

### 存储与写入

- `.nand/config/settings.json` news命名空间：源、权重、prompt、display、views、目录；Agent选择/绝对cwd/运行偏好可device scoped（cwd更宜vault-relative持久化，执行时canonicalVaultCwd）。
- `.nand/news/<device-id>/materials.json`, `analyses.json`, `events.json`, `heat.json`, `runs.json`, `reader-state.json`：JsonStore，version envelope，30天默认按引用保留必要事件链；不可把收藏/笔记视作缓存清理。
- Markdown默认目录按issue，中文路径不跟界面语言切换。生成时处理标题非法字符和重名；更新管理块或只创建避免覆盖“我的批注”；笔记读列表来自vault实际文件，不仅缓存指针。使用现有safe text/vault写入习惯，正文有未保存编辑则报状态。
- 每日quota属于device（native CLI和receipt在设备），默认20实际调用；日界明确用设备时区或配置时区。修复/双评分/深入了解都计数；没新material不调用。usage unavailable是unknown。保留终端不等于保留无限raw output。

### 设置默认值（覆盖issue第7节）

| 分组 | 全部字段 | 建议基线 |
|---|---|---|
| 一般 | stale阈值、启动刷新、保留天数、收藏目录、日报写入/目录、通知 | 60min、false、30d、`NAND/新闻/收藏`、false/`NAND/新闻/日报`、仅失败 |
| 信源 | CRUD/enable/tier/mode/group/owner/interval/test、自适应、OPML | 默认空；添加示例是明确按钮；adaptive true 15–60；signal max180 |
| 兴趣 | 画像、主题、屏蔽词、分类表、tag白名单 | 空画像/屏蔽，内置可修改通用分类 |
| AI | 已启用CLI selector、cwd、batch count/body length、timeout、每日次数、双评分、回读渠道、保留终端、4类可编辑prompt/hash/reset | 第一可用CLI（无则需设置）；库根；12/1500（实际argv容量额外约束）；10min；20；false；按能力auto；false；内置 |
| 评分 | T1/T1_5/T2、understandFloor、7×5矩阵 | 60/65/76；50；行sum=10，整数非负，axes 0..10整数 |
| 热度 | window/half-life/minParticipants/topN、trend compare、up/down与rising、surge人数/比例 | 48h/24h/2/10；6h；10%方向/15%rising；3/50% |
| 日报 | 正文/快讯/每源/记忆 | 12/10/2/7d |
| 归组 | 召回天数/lexical门槛/tie/merge review | 14/0.25/0.8/0.75 |

每个配置保存都校验正范围；权重/门槛/热度/日报规则变更立即用已有结果重算，不调用AI。画像/prompt变化只影响新材料，手动重分析是显式操作且计额。

## R-007 — 独立验收标准建议

类型：recommendation；AC对应用户可见结果或真实领域规则；不为每个纯转发wrapper造测试。

- **N-AC-01 模块**：启用→显示新闻工作台/设置；禁用→仅取消news拥有运行并移除所有定时/订阅/DOM；再启用加载已有数据；原有手动Agent和automation继续工作。startup预算不增加news逻辑闭包。
- **N-AC-02 采集**：固定RSS2/Atom/JSON Feed fixture导入；canonical别名合1、hash改1修订；首次/旧文/未知日期不进今日；单源错误其余源成功；按due/backoff恢复；retry按钮可用。
- **N-AC-03 CLI**：至少Claude Code与Codex真实账号完成prompt→native结束→完整JSON→入库→自有终端关闭；其余4CLI输出能力、等待权限、限长逐一列文档支持状态，不得写“已支持”而无证据。
- **N-AC-04 有界运行**：模块off、agentoff、缺CLI/helper、权限待处理、oversize、格式坏、未知/缺id、非法axes/target、cancel/timeout均落明确终态/attention；没有永久分析中；timeout停止实际terminal且下一批可运行。
- **N-AC-05 预算与重复**：相同revision/effective prompt/agent sample重复刷新不调用；一次修复计额；每日上限达到停止；重启inflight标interrupted不自动重放；已received可应用无新调用；unknown usage不显示0。
- **N-AC-06 评分**：7×5固定权重、整数axes、单/双评分阈值与严格understandFloor、质量cap；调整权重立即重排且runner调用计数不增；tier仅影响门槛/代表不出现在评分输入。
- **N-AC-07 分组**：同次多源归一occurrence、跟进同event新occurrence；相同公司独立发布分开；ROUNDUP只mentions；低置信度待确认不自动精选；同批多稿不重复开event；合并旧链接仍到当前event。
- **N-AC-08 热度**：固定clock下同参与方多稿只计最新一条，48h/24h公式、2参与+1editorial、稳定排序；late/stale source不制造趋势；new/up/down/flat/unknown与surge/new/rising边界；小时缺口不当0。
- **N-AC-09 要闻**：12正文/10快讯/每源2、7日记忆、官方+3补入、follow-up资格、roundup折入、全部跟进日特例按最终决定；从已有分析生成，无AI调用；写日报只在设置打开时。
- **N-AC-10 阅读**：七主要section可导航；来源+原标题+中文摘要可追溯；score详情、我的视图、隐藏不感兴趣、事件正倒序、收藏、打开原文、attachMaterial不发送；page state分屏/重启隔离恢复；已读保留。
- **N-AC-11 Markdown**：收藏/简报可读可编辑；golden write→read往返覆盖frontmatter和管理块；用户批注不被刷新覆盖；cache清理/plugin卸载后笔记仍存在；简报是AI生成并带素材来源。
- **N-AC-12 Widgets**：3kind/多实例独立设置；更新/进度/按钮；条目准确深链；moduleoff占位不丢实例；home读`peek`不激活news；widget dispose取消订阅不取消全module正在执行的用户刷新。
- **N-AC-13 P5**：OPML导入保留原源且按URL去重，导出可重导；web-list用用户selectors读取HTTP HTML，不执行站点JS、不引入登录/付费源；不支持页面显示可处理状态；7日图真实有缺口。
- **N-AC-14 工程/界面**：本module模型/runner边界针对性tests、`test/golden/user-formats.test.ts`扩展、原agent/automation受影响tests；最终build/lint/i18n/architecture/check:bundle/lint:css/docs一次汇总通过。真实Obsidian ≥960/600–960/<600，深浅色及preset、键盘、popout、disable/enable、restart截图/证据。重新生成main.js/styles.css；新增模块预算而不扩大startup预算。

## R-008 — 纵向 tickets / 依赖 / 验证（建议9票，可拆成多个change但不漏范围）

每票交付用户行为+存储+界面最小闭环，不按“只建空类型/只加测试”水平拆分。下表paths中news均拟新增。

| Ticket | 垂直结果/主要路径 | 依赖 | 最小证据 |
|---|---|---|---|
| NEWS-01 固定规则与CLI能力探针 | `docs/third-party/aihot-news.md/.ZH.md`映射，`docs/news.md/.ZH.md`能力表初稿；在真实测试vault实测6CLI completion字段/native session定位/最长input输出/权限等待；保存版本与结果。无需另造benchmark平台 | 终端组件#135能安装/启动；真实Claude/Codex账号可用才完成实测 | 2个必测账号端到端JSON截图/trace、其余真实支持或未测标识；source mapping与license无缺项 |
| NEWS-02 原始新闻可看可收藏 | 新`news/{manifest,api,module,settings,i18n}.ts`、`core/{model,materials,source-schedule}.ts`、`platform/{feed-reader,store,notes}.ts`、`services/news-service.ts`、`ui/{workbench-page,NewsPage,settings-page}.tsx/ts`、`styles/news.css`；app module/workbench/settings registrations；RSS/Atom/JSONFeed、source设置/试抓、健康、原始列表、收藏笔记 | 无AI依赖；NEWS-01规则研究可先并行但不要等待账号才做基础 | feed/identity/timeline固定fixture、notes golden、enable/disable smoke、build/i18n/architecture/budget |
| NEWS-03 程序一次性提示词runner | `agent/api.ts`新`AGENT_PROMPT_RUNNER`；`agent/services/agent-runtime.ts`抽共享执行入口+automation adapter；`services/prompt-runner.ts`、`platform/desktop/history/last-assistant.ts`及必要native hooks；module/manifest提供；news运行页可手动发测试分析请求 | NEWS-01能力证据、#135 helper；NEWS-02页面/运行store | native event大文本不丢完成、reader取得完整答案；取消/timeout/agent禁用；automation现有契约回归；无ANSI猜测 |
| NEWS-04 AI精选与预算闭环 | `news/core/{prompts,analysis,scoring}.ts`、`services/analysis-service.ts`、`ui/{RunHistory,AnalysisDetail}.tsx`、settings兴趣/AI/weights；batch、1次repair、receipt、quota、单/双评分、精选/全部、五维显示 | NEWS-02+03 | 固定axes与validation案例；1次repair/配额/重启契约；实账号12条样本能回读并入库；调权重不增调用 |
| NEWS-05 事件归组与热点阅读 | `core/{grouping,representative,heat}.ts`、events/heat存储、`ui/{EventDetail,HotList,HeatChart}.tsx`，关系prompts及source参与者配置 | NEWS-04 | 同发生/跟进/ROUNDUP/同批去重样本；热度/趋势确定值；代表稿与source数量；7天图缺口/键盘 |
| NEWS-06 今日要闻/我的视图/深入了解 | `core/{edition,views}.ts`、`platform/notes.ts`扩日报/简报、`services/news-service.ts`、`ui/{DailyEdition,ViewEditor,BriefDetail}.tsx`；browser/Agent材料动作；notifications api幂等发送+opener | NEWS-05 | 公式/上限/记忆fixture；保存筛选后重启；简报真实CLI+Markdown；attach未自动发；日报无AI；notification仅一次 |
| NEWS-07 首页新闻实例 | `news/contrib/home-widgets.ts`（仅允许API/loader边界）、`news/ui/widgets/{NewsWidget,settings}.tsx/ts`、`news/api.ts`读service；需要时home registry只通过home/api contract | NEWS-04起可精选，NEWS-05热点，NEWS-06视图；**#134统一组件注册表ticket** | 三类型两实例不同config，点击准确详情；news关占位保留；peek不启用；重新开恢复 |
| NEWS-08 完成采集工具与平台边界 | `platform/{opml,web-list-reader}.ts`、source设置/preview；desktop-only gate或移动readonly按ADR决定；不增Node越界 | NEWS-02，web-list复用同material/analysis pipeline | OPML往返/重复URL/无修改已有原源；简单静态HTML链接选择与日期；移动能力文案准确；不加headless浏览器 |
| NEWS-09 文档、许可、真实Obsidian综合验收 | `docs/news.md/.ZH.md`、`docs/data.md/.ZH.md`、`docs/README.md/.ZH.md`、third-party映射+LICENSE+NOTICE、skills owned facts、`scripts/bundle-budget.json`, `scripts/module-strings.ts`, `src/styles.json`, built main.js/styles.css；真实Obsidian probe覆盖所有闭环 | 01–08，home registry已集成 | 一轮完整工程gates+UI主题/宽度/键盘/restart/disable截图；真实CLI能力矩阵；列出仍未实测的平台而不假通过 |

关键依赖：NEWS-02不被helper修复阻塞；NEWS-03/04实测受#135；NEWS-07只受#134 registry具体ticket而非整版home所有功能。本轮只规划；后续current按用户决定严格串行执行。跨change共享 `app/contracts`/`compose-workbench` 修改需由当前票顺序集成，避免覆盖其他change新增module id。

## Conflicts and Unknowns

### 用户决定与执行期仍需事实的点

本轮用户已明确确认：新闻默认关闭；桌面完整，手机读 Markdown；周期刷新默认关闭，保留手动与 opt-in stale/startup；支持双评分但默认关闭；已启动结果未知的AI批次中断后手动重试；完整保留P5；本轮仅完整规划，后续执行 current 严格串行。以下相应条目为已决定合同，不再向用户重复确认。其余推荐仅用于细化实现。

1. **真实CLI结果通道与长度**（高影响/可发现事实）：6 CLI installed版本、完成事件字段与账号登录，只能实测。当前research没有账号调用，不可将#136 P0写成完成。最少Claude/Codex真实通过是issue AC；缺账号应保留execution gate，而非让整个文档规划停住。
2. **默认启用、刷新授权、移动范围**（产品决定）：建议defaultEnabled=false（dev已有依据）；显式启用news并保存自动刷新配置授权后，page/widget的`visible`事件交service请求stale refresh，渲染函数保持纯读。周期timer只做本地heat snapshot/到期判定，不额外加cron；运行时周期采集暂不启用。移动模块先只读收藏Markdown还是readonly同步cache由根代理记录推荐/待定；缓存device-scoped不会自动共享，不能同时说“只读同步数据”又没有reader选择来源。
3. **今日要闻日界**（产品决定）：AIHOT 08:00 Asia/Shanghai出刊服务端定时不适合本地“今日”。建议设备时区自然日、用户显式/refresh重编排，写文件当天同名managed region；来源发布时间统一UTC instant。若要08:00规则需明示设置和错过行为。
4. **新signal源/owner配置信息**（实现必要）：仅“归属分组”不足AIHOT所有独立参与/官方代表稿规则，Source需ownerEntity/publisherRole/author策略。可先用户配置，不实现庞大实体识别库。
5. **双评分合批独立性**：建议默认单评分且可开启2次不同会话/调用；模型参数无法保证随机独立时，文档称“独立调用”并写CLI限制，不能承诺AIHOT供应商精度。
6. **重启重试与已付费未知**：建议显式重试已有启动但未知结果，自动触发只处理未启动或已收到可应用结果。轻量receipt就足够，不搬AIHOT多重自动放行。
7. **#136 P5与周/月报**：OPML/web-list/双评分/7天图有tickets；周/月仅第3节研究项不在交付清单，明确本轮不做。若根代理决定完整上游等价，周/月需新增ticket而不能藏在“完善”。

### 可自主确定、无需阻塞用户的问题

目录归属、默认上限20/批12/正文1500为issue给定建议；具体硬cap根据CLI探针收敛。`requestUrl`放platform而非desktop；消息/headers小组件名称通过t；不增加新设计系统；“新闻”显示不叫AIHOT；source失败不抹数据；收藏用户内容不属缓存。这些已有开发规则与用户授权，不应新增确认轮。

## Recommendation

按“采集与可持久收藏 → 完整Agent返回 → 可解释精选 → 事件/热度 → 视图/日报/简报 → 首页 → OPML/web-list/验收”建立一个新闻领域change（或runner单独agent基础change并用ticket依赖）。将NEWS-01实测视为实施入口证据而不是用静态阅读冒充已完成。算法只写本项目所需纯函数，使用JsonStore与现有模块生命周期，不复制服务端架构，不增加多provider兜底或冗余测试。最有价值的测试是领域数字fixture、真实CLI回读契约、Markdown golden与真实Obsidian工作流。

## 本次最终核对

重新读取GitHub仍为原13个open issue，updated_at无漂移。上述研究中候选票数/未决偏好为探索轨迹；最终权威为当前Spec与61票整体清单，用户已明确确认全部G设计分支。权限writer覆盖及每级symlink；Git库外unstage-all与实际push target；档案准确字节规模工具；终端五平台资产验证；HOME_WIDGETS每模块provider bundle；dispatch交付与prompt结果严格分离；自动化typed workflow装配、编辑器和receipt；browser内部scope与短期runContext env仅最终spawn合并、不进入accountKey；浏览器manifest和真正UI入口；永久ADR保持只读；站点/历史等虚假串行依赖已移除。
