[English](aihot-news.md) | 简体中文

# AIHOT 新闻参考

新闻模块参考 [KKKKhazix/AIHOT 的提交 c547b669acc7f64720cd82024e502446ee1ef88d](https://github.com/KKKKhazix/AIHOT/tree/c547b669acc7f64720cd82024e502446ee1ef88d)。上游采用 MIT 许可证，版权行为 Copyright (c) 2026 数字生命卡兹克。NAND 随附未改写的[许可证全文](aihot-LICENSE.txt)，并在 [NOTICE](../../NOTICE) 中署名。

| NAND 实现 | 上游参考 | 行为 |
|---|---|---|
| `src/modules/news/core/materials.ts` | `packages/backend/src/content/materials.ts` 的 `decideTimeline` 和 `fillPublicationTime` | 首次导入、超过 48 小时的旧文、缺失日期，以及超过未来一小时的日期不进入今天阅读列表。后续补日期仍以首次发现时刻判断。 |
| `src/modules/news/core/materials.ts` | `packages/backend/src/content/materials.ts` 的 `contentHash`、`upsertIn` | 合并空白后的标题、正文、摘要以 U+0001 分隔，计算 SHA-256 标识内容修订。缺省的正文、摘要保留已存文本；相同规范 URL 的其他来源不能替换原来源内容。NAND 同时对来源条目标识使用 SHA-256。 |
| `src/modules/news/core/source-schedule.ts` | `packages/backend/src/sources/collect.ts` 的 `adaptIntervals` | 最近七天非回填资料的日均产量决定 15–60 分钟的间隔，信号源上限为 180 分钟。连续失败逐次增加等待时间，最多 360 分钟。 |
| `src/modules/news/core/scoring.ts` | `industry/selection.ts`、`industry/prompts/selection-score.md` | 七类整数权重、证据质量上限、60/65/76 分级门槛、向下取整的展示均分，以及严格大于 50 的写法规则。保留原始维度用于本地调权重。 |
| `src/modules/news/core/prompt-templates.ts` | `industry/prompts/prefilter.md`、`selection-score.md`、`structure.md`、`content-understanding.md` | 不可信材料边界、事件口径评分、相关性状态、分类和标签词表、带原文引句的事实框架，以及中文写作规则。 |
| `src/modules/news/core/prompts.ts` | `packages/backend/src/editorial/prompts.ts` | 有效模板和依赖的哈希，缺失变量或包含项时明确报错。 |
| `src/modules/news/core/recall.ts`、`grouping.ts` | `packages/backend/src/events/recall.ts`、`relate.ts`、`group.ts`；`industry/prompts/group-definitions.md`、`group-method.md` | 十四天发现窗口，标题加摘要前 300 字符，字符二元组重叠至少 0.25，每次发生取最佳报道、前十候选。四种明确关系采用 0.8 关联门槛；进展直接关联根发生，合集只提及事件，既有事件合并需要独立复核根发生且达到 0.75。保留别名解析旧事件 ID。 |
| `src/modules/news/core/representative.ts` | `packages/backend/src/publication/representative.ts` | 先取独立来源最多的发生，平手取更早者；内部依次优先 T1、主体匹配的机构／个人发布者、全文、高分、较早时间和稳定 ID。 |
| `src/modules/news/core/heat.ts` | `packages/backend/src/events/hot.ts`、`publication/hot.ts`；`apps/web/app/features/hot/curve.ts` | 按参与方去重，取 48 小时内最新原文发布时间，以 24 小时半衰期衰减，与六小时前的窗口比较。至少两个参与方且包含一个编辑来源参与方，显示前十。增长比较排除晚加入或落后的参与方，整段历史曲线使用同一来源覆盖范围。 |
| `src/modules/news/core/edition.ts` | `packages/backend/src/reports/edition.ts` 的 `dailyMemory`、`dailyEdition`、`arrangeDaily` | 每事件一条；重要性为 `(score ?? 50) + 5 log2(1 + 参与方) + 官方 × 5 − 跟进 × 6`。正文十二条、快讯十条，每个主报道来源最多两条正文。记忆七天内引用过的发生；新当事方动作或四源跟进可进正文，保留全跟进日特例；合集归到提及的最重要事件，官方报道有三个独立参与方时可在未精选情况下补入。 |

NAND 通过 Obsidian 的 `requestUrl` 采集，由有界的本地服务队列和设备 JSON 存储承载数据。可见收藏和简报通过 Vault API 写入 Markdown。NAND 不包含 AIHOT 的服务端、数据库、付费采集器、模型 API 凭据、名称或标志。RSS、Atom、JSON Feed 和 OPML 通过宿主 DOM 解析遵循各自格式；静态网页列表按照用户选择的 CSS 选择器提取，不执行页面脚本。

需求中的本地预过滤由 NAND 的 `core/analysis-policy.ts` 实现：新分析调用前按屏蔽词、最少字符数及订阅源声明语言过滤，与上游编辑相关性提示词分开。缺少语言元数据的材料仍允许分析。可配置的分类、主题、实体词表同时参与实际提示词哈希和严格回复校验，每个耐久分析计划保存词表快照。设置页可恢复默认词表或四类默认模板，并显示实际 SHA-256。这些操作使用 NAND 设置和本地恢复机制，不引入上游服务端依赖。

NAND 每批最多十二条资料，默认正文摘录为 1,500 字符，并额外限制序列化后的 CLI 输入大小。相关性、原始评分轴、结构、写作和候选关系合并在一个带标记的 JSON 回复中。上游分别调用这些阶段，并返回已经计算的注意力分数；NAND 在程序中计算分数，可选的双评分使用两次独立调用。批内匿名 ID 不包含来源身份，模型不会收到来源等级或上次分数。合批差异仍须通过标注材料和真实 CLI 回复进行对照，协议夹具不足以证明编辑质量等价。

本地运行记录在调用 CLI 前保存额度预留，收到完整回复后先保存原文，再应用业务记录。分析、格式修复、双评分、合并复核和简报共用每日额度。重启可在本地消费已经收到的回复，已启动但结果未知的调用则要求显式重试。这些执行规则复用 NAND 原生 CLI runner 和私有 JSON 存储，不使用 AIHOT 的服务端队列或直连模型 API。

NAND 的词法召回还包含同批较早的资料。每条资料必须对每个候选恰好给出一个判断，缺失目标或引用未提供的目标均不通过校验。根发生合并复核独立于首次分析。分组和代表稿夹具覆盖重复报道、直接进展、合集、低信心、来源数平手及别名恢复；原生 Obsidian 协议探针覆盖阅读、耐久复核和重启。NAND 不使用向量、社交帖回复元数据或上游数据库合并机制。

NAND 仅在本地模块运行期间观测完整小时。启动、休眠和离线期间保留缺口。后续采集可以修复已观测小时的覆盖情况，但不能补造未观测小时。保留七天观测，包括尚未进入前十的事件。曲线至少需要三个完整观测，保留缺口并标注实际本地时间范围；修改来源角色或所属主体会用保留的证据重算，不调用模型。社区作者身份以配置的来源组或来源作为命名空间，不依赖上游来源包名称。原生图表检查使用明确标记的历史夹具，不声称已进行七天连续监测。

NAND 今日要闻采用设备时区的自然日，不采用 AIHOT 服务端在 Asia/Shanghai 08:00 定时出刊的规则。每次编排在设备阅读状态中保存日期、时区和准确的起止时刻。采集、分析或显式编排会记录当期；阅读与筛选在本地完成，不调用模型、不写 Markdown。可选的日报笔记设置更新当天同一文件的管理区，并保留批注。我的视图保存稳定 ID 与有界筛选；每个工作台叶子分别保存当前分区、筛选、选中项和时间线顺序。

上表中的热点与要闻数值为默认值。NAND 的 `core/editorial-rules.ts` 和原生设置为热度窗口／衰减、参与方／榜单上限、对比／标记门槛，以及日报条数／来源上限／记忆天数提供有界本地配置。保存后用保留的证据重算，不调用模型；热度规则版本标识实际参数，历史曲线保留原先观测的小时。已发布记录最多保留 30 天，日报默认仍记忆七天。

上游周／月报参考按最高分、`5 log2(1 + 最大来源数)`、头条六分、重点三分，以及 `4 × (刊载天数 − 1)` 排序。这里仅记录研究映射：NAND 当前范围交付今日要闻，不提供周／月报产品入口。

本对照记录已经实现的规则。阅读流程、首页组件及原生 CLI 验收另有要求，本文不将这些要求视为已经完成。

资料哈希使用宿主 Web Crypto。保留旧 32 位 FNV 碰撞对 `item-1ppgtvf` / `item-rx6lxj`，回归验证内容修订与来源条目 ID。已接受过的内容哈希随缓存保留，订阅轮换回旧文本时保留当前修订，不再请求分析。NAND 将这些哈希存入资料 JSON，不保存上游的完整修订历史表；清理缓存或缓存过期也会清除这份历史。
