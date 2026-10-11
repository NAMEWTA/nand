---
schema_version: 1
artifact: "source"
change: "2026-10-08-news-aihot"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/136"
captured_at: "2026-10-09T03:57:00.913Z"
content_sha256: "31ef157f7ca3105e8843488982fbaecd4afc9bfd67d01fe48ea7db65b04f30c2"
remote_state: "open"
close_capability: "supported"
---

# Source: #136 [新闻][新功能] 深度参考并仿照 AIHOT 的热点新闻实现，新增「新闻」模块：独立页面、首页小组件、设置集中配置，AI 部分复用现有 Agent CLI

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T14:47:22Z / 2026-10-08T14:47:22Z
- Labels: ["enhancement"]
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:57:00.913Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 31ef157f7ca3105e8843488982fbaecd4afc9bfd67d01fe48ea7db65b04f30c2。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content


## 一、背景与目标

**本 issue 要求：深度参考并仿照开源项目 [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT) 关于热点新闻的实现方式**（信源采集、判重、AI 预筛 / 打分 / 写作、事件聚合、热度排序、日报编排、阅读界面），为 NAND 新增一个类似「新闻」的功能，增强 NAND 的内容。

参考的重点是**做法和规则**：AIHOT 怎么实现、有什么特点、权重怎么算。然后按 NAND 的模块、工作台、设置和存储规则重写，不照搬它的服务端架构。

### 核心功能（原始需求）

| 编号 | 需求 | 本 issue 对应章节 |
|---|---|---|
| (a) | **内容展示**：点击后可按我需要的内容做相关展示 | 五、(a) |
| (b) | **首页小组件**：提供新闻小组件，供首页添加 | 五、(b) |
| (c) | **独立界面**：一个独立的、专门用来查看和收集新闻的页面（和现在的「AI Agent」页一样是工作台里的一页） | 五、(c) |
| (d) | **配置管理**：信源、配置等统一放在 NAND「设置」里，方便自行配置 | 五、(d)、七 |

### AI 调用的原则（原始需求）

- **尽量直接复用 NAND 已经实现的 Agent CLI**，在里面直接调用 Agent 终端，不另接模型 API。
- 这**有点像定时任务，但不是定时任务**：由程序主动触发，把一大段提示词发给 Agent CLI，等它生成内容，再把结果读回来。

### 已核对的基线

- NAND：`main` [`21f852b`](https://github.com/NAMEWTA/nand/commit/21f852bc2d91d60335f57a4bc38a1e663e8b05eb)（manifest `1.0.0`，`minAppVersion 1.13.0`）。
- AIHOT：`main` [`c547b66`](https://github.com/KKKKhazix/AIHOT/commit/c547b669acc7f64720cd82024e502446ee1ef88d)（2026-10-08）。
- 本 issue 来自两边源码和文档的静态阅读，**没有做运行测试**。下文写「待验证」的地方需要实测。

---

## 二、参考项目与许可

- **许可**：AIHOT 代码是 **MIT**（[LICENSE](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/LICENSE)，Copyright (c) 2026 数字生命卡兹克）。[NOTICE](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/NOTICE) 另外说明：**「AIHOT」名字和 Logo 不在 MIT 授权内**；`assets/og-fonts/` 是 OFL 1.1；示范信源的内容属于各发布方。
- **做法**：MIT 允许改编，但本需求要求「深度参考并仿照、按 NAND 架构重写」，所以**借鉴思路、规则和参数，按 NAND 的分区和模块契约重写，不整段复制代码**。如果某段提示词或算法改编自 AIHOT，在文件头注明来源和上游提交，并按 [licensing 规则](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/.agents/skills/dev/references/licensing.md) 更新 `NOTICE`（保留 MIT 版权声明）。
- 界面、命令、文案里**不使用「AIHOT」名字和 Logo**。

---

## 三、AIHOT 实现拆解（以源码为准）

### 3.1 整体流程

AIHOT 是一个服务端站点：Node 24 + Fastify + PostgreSQL + pg-boss 队列 + React Router SSR，分 api / worker / web 三个进程（[architecture.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/docs/architecture.md)）。一条资料的处理流程：

```
信源（RSS / 网页列表 / JSON / X / 公众号 / 外部推送）
 → 采集：URL 规范化判重 + 内容哈希判修订，必要时补正文
 → 预筛 prefilter：PASS / BLOCK / UNKNOWN
 → 评分：同一份标准独立打两次 0–100 分（与结构化抽取并行）
 → 结构化：分类、标签、主体公司、scope（single / composite / unknown）、事实 fact
 → 写作：中文标题 + 答案先行的摘要 + 推荐理由
 → 归组：召回 14 天内候选 → 模型判断两篇报道的关系 → 聚成「事件」
 → 热度：按事件、按独立参与方计算
 → 日报 / 周报 / 月报：按规则编排，日报不调模型
```

每一步的提示词都在 [`industry/prompts/`](https://github.com/KKKKhazix/AIHOT/tree/c547b669acc7f64720cd82024e502446ee1ef88d/industry/prompts)，改标准不用改代码。**提示词版本就是内容哈希**：改了提示词，之后的新资料按新版判断，已经判过的不重算（[selection.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/docs/selection.md)）。

### 3.2 主要特点

1. **「信源分级」和「评分」分开**：评分输入**故意不给**信源分级、信源名、是否一手（[selection-score.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/industry/prompts/selection-score.md)「评估边界」），分级只影响入选门槛和代表稿选择。
2. **评分只给一个整数**，内部按五个维度加类型权重算出来；**两次独立评分**，减少单次偶然。
3. **按事件算热度，不按文章算**：同一家信源发十篇只算一次，重复抓取不加热度。
4. **提示词里有明确的安全边界**：材料里的指令一律当作不可信数据，不执行。
5. **旧文不刷屏**：发现时已发布超过 48 小时的资料、新信源第一次导入的存量，按原文时间归档，不进「今天」。
6. **花钱的调用有回执和预算熔断**（[architecture.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/docs/architecture.md)「几条不变的规则」）：重启或重试时复用已经付费的结果。
7. **页面不调模型**：读者打开页面只读已经算好的结果，模型只在后台任务里调用。
8. **可校准**：用自己标注的样本跑 `scripts/eval-selection.ts`，扫描门槛 40–90。

### 3.3 权重与排序（具体公式与位置）

#### ① 单条资料评分：五维 × 类型权重

[selection-score.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/industry/prompts/selection-score.md)：先把材料归到 7 类之一，再给五个维度各打 0–10 的整数分。五个维度是 sig 实质份量、nov 信息增量、cred 证据强度、reson 共振面、act 可用性。

`attentionScore = sig×w1 + nov×w2 + cred×w3 + reson×w4 + act×w5`（每行权重和为 10，所以结果在 0–100）

| 类型 | sig | nov | cred | reson | act |
|---|---:|---:|---:|---:|---:|
| model_release | 3 | 2 | 2 | 2 | 1 |
| product_launch | 2 | 2 | 1 | 2 | 3 |
| tool_or_prompt | 1 | 2 | 1 | 2 | 4 |
| research_paper | 5 | 3 | 1 | 0 | 1 |
| industry_event | 3 | 1 | 2 | 4 | 0 |
| opinion_analysis | 1 | 3 | 1 | 4 | 1 |
| tutorial_explainer | 1 | 1 | 1 | 3 | 4 |

提示词里还写了「压分」规则，例如：例行小版本、平台上架 `sig ≤ 3`；营销、招聘 `sig ≤ 2`；只有预告 `nov ≤ 3 且 cred ≤ 4`；标题和正文不符时总分 ≤ 30。模型**只输出** `{"attentionScore": N}`。

#### ② 是否入选：两次分数之和对比分级门槛

- [analyze.ts L48 `SCORE_CALLS = 2`](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/editorial/analyze.ts#L48)、[L437–449 `normalizeAnalysis`](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/editorial/analyze.ts#L437-L449)：
  `selected = 预筛通过 && s1 + s2 ≥ 2 × threshold(tier)`；显示分 = `floor((s1 + s2) / 2)`。
- [industry/selection.ts](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/industry/selection.ts)：`thresholds = { T1: 60, T1_5: 65, T2: 76 }`（T1 官方一手，T1_5 官方账号 / 准官方，T2 媒体与个人；没列出的分级不参与精选）；`understandFloor = 50`：没入选但均分高于 50 的，也用精选的写法写标题和摘要。
- 分数够了还要等归组确认「不是精选里已有新闻的重复、并且有新信息」，才真正进精选。

#### ③ 事件热度（热点榜）

[events/hot.ts](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/hot.ts)：`HOT_RULE_VERSION = "heat-v1-48h-halflife24h"`，`WINDOW_HOURS = 48`，`HALF_LIFE_HOURS = 24`，`MIN_PARTICIPANTS = 2`（L57–60）。

```
参与方 p：48 小时窗口内，对该事件至少有 1 条报道的「独立参与方」
heat(事件, t) = Σ_p 0.5 ^ ((t − last_p) / 24h)     // last_p = 该参与方在窗口内最新一条的「原文时间」
展示值 heatIndex = round(heat × 100) / 10            // 放大 10 倍，保留 1 位小数
```

- **参与方怎么认**（[`currentSignals` L113–129](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/hot.ts#L113-L129)）：社区源（DEV / HN）按作者；属于同一个「信号组」的算一个；同一家公司的多个官方渠道（`owner_entity_id`）算一个；其余按信源。`isolated` 的信源不计；已撤回的不计；`editorial` 信源的报道必须是这个事件的事实证据才计入。
- **上榜条件**（[`computeHotRanking` L183–186](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/hot.ts#L183-L186)）：参与方 ≥ 2 且其中至少 1 个是 editorial；按 heat 降序，同分按最近时间；取前 10。
- **趋势和角标**（L218–238）：和 6 小时前比（用 6 小时前自己的 48 小时窗口）。如果有信源抓取落后（连续 3 个间隔、至少 90 分钟没成功），或者信源是窗口开始后才加的，这些参与方不进对比。`pct = (cur − prev) / prev`；以前没热度 → `new`；`> +10%` 上升，`< −10%` 下降。角标：`surge`（6 小时内新加入的参与方 ≥ 3 且占 ≥ 50%）、`new`（首条报道不到 6 小时）、`rising`（非 surge 且涨幅 > 15%）。
- **代表稿**（[representative.ts L15–40](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/publication/representative.ts#L15-L40)）：T1 优先；其次是核实过的官方账号（机构先于个人，且账号主体就是新闻主体）；再按有全文、分数高、发得早。事件链接指向「报道信源最多的那条事实」，避免先出来的爆料抢走链接。
- 每小时存一次快照（`story_heat_hourly`），事件页画 7 天热度曲线。

#### ④ 日报 / 周报 / 月报的排序

- 日报（[reports/edition.ts L25–34、L289–291](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/reports/edition.ts#L289-L291)）：
  `importance = (score ?? 50) + 5·log2(1 + 参与方数) + (有官方原帖 ? 5 : 0) − (是跟进 ? 6 : 0)`
  正文 12 条，同一信源最多 2 条，再加 10 条快讯；最近 7 期报过的事件只有当事方有新动作或 ≥ 4 家信源报道时才进正文。日报**不调模型**。
- 周报 / 月报（[L192–193](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/reports/edition.ts#L192-L193)）：
  `rank = 最高分 + 5·log2(1 + 最多信源数) + (当过头条 ? 6 : 0) + (当过看点 ? 3 : 0) + 4·(上了几天 − 1)`；模型只写总述和栏目导读。

#### ⑤ 判重与归组

- **URL 判重**（[lib/url.ts L8](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/lib/url.ts#L8)）：统一为 https、小写主机、去掉 `www.`、去 fragment、去 `utm_*`/`fbclid`/`spm` 等跟踪参数、参数排序、去结尾斜杠；微信文章只保留 `__biz/mid/idx/sn`；X 帖子按帖子 id。
- **内容修订**（[materials.ts L121](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/content/materials.ts#L121)）：`sha256(标题 | 正文 | 摘要)`（先合并空白）。哈希变了才算新修订，才重新分析。
- **候选召回**（[recall.ts](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/recall.ts)）：最近 14 天（`RECALL_DAYS`）。配了向量服务时用标题 + 摘要的余弦相似度（[group.ts L38–44](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/group.ts#L38-L44)：召回 ≥ 0.6，取前 10 个事实；低于 0.85 的合并要复核模型再确认）；没配向量服务时用**中文字二元组重合度**（[relate.ts L194 `lexicalSimilarity`](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/events/relate.ts#L194-L204)：`交集 / min(两边二元组数)`，门槛 `LEXICAL_MIN = 0.25`）。
- **关系判断**（[group-pair.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/industry/prompts/group-pair.md)、[group-definitions.md](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/industry/prompts/group-definitions.md)）：`SAME_OCCURRENCE`（同一次发生）/ `SAME_STORY`（同一事件的后续进展）/ `UNRELATED`（无关）/ `ROUNDUP`（汇总稿），附 `confidence`。置信度 ≥ 0.8（`TIE_MIN_CONFIDENCE`）才算连上；两个事件合并的复核门槛是 0.75。

#### ⑥ 抓取频率

[sources/collect.ts L377–400 `adaptIntervals`](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/packages/backend/src/sources/collect.ts#L377-L400)：每天按最近 7 天的日均产出调整间隔：`round(1440 / (每日条数 × 3))`，限制在 15 分钟到上限之间（普通源上限 60、付费列表 120、热度信号源 180）；日均 ≤ 0.15 条时直接用上限。失败后等待 `min(间隔 × (失败次数 + 2), 360)` 分钟（L96）。

### 3.4 阅读界面的特点（[apps/web/app/routes/](https://github.com/KKKKhazix/AIHOT/tree/c547b669acc7f64720cd82024e502446ee1ef88d/apps/web/app/routes)）

- 首页：「精选 / 全部」切换、分类标签、搜索、时间线卡片（中文标题、摘要、推荐理由、分数、分类、信源）。
- 热点页：排名、热度值、趋势和涨幅、角标、参与信源头像。
- 事件页：同一事件的多篇报道折成一组，进展时间线可切换「最新 / 最早在前」，有 7 天热度曲线和事件综述。
- 日报 / 周报 / 月报、主题页、收藏和已读（存在浏览器 `localStorage`，[lib/local-state.ts](https://github.com/KKKKhazix/AIHOT/blob/c547b669acc7f64720cd82024e502446ee1ef88d/apps/web/app/lib/local-state.ts)）。

### 3.5 哪些照搬，哪些改，哪些不做

| AIHOT 的做法 | 到 NAND 怎么处理 | 原因 |
|---|---|---|
| 服务端 + PostgreSQL + 队列 | **不搬**。NAND 模块在 Obsidian 内运行，数据用 `.nand/` 下的 JSON 和库里的 Markdown | NAND 是本地插件 |
| OpenAI 兼容 API 直接调用模型 | **改为调用现有 Agent CLI** | 原始需求；复用用户已登录的 CLI 账号 |
| 五维 × 类型权重、分级门槛、两次评分 | **保留规则**，参数放进设置 | 这是它的核心「品味」 |
| 热度公式（48h 窗口、24h 半衰期、独立参与方） | **保留公式**，参数可调 | 和信源数量无关，个人规模也成立 |
| 向量召回 | **首版不做**，用字二元组重合度 | NAND 没有向量服务；AIHOT 本身也支持这个降级 |
| 一条资料多次调用模型（预筛、评分 ×2、结构化、写作、归组） | **合并成按批调用**（一批材料一次 CLI 调用） | 每次启动 CLI 很慢，也耗订阅额度 |
| X / 公众号 / Jina 付费抓取 | **首版不做** | 需要密钥和付费；先做 RSS / Atom / JSON Feed |
| 公开网站、RSS 输出、MCP、后台 | **不做** | 个人工具不需要 |

---

## 四、NAND 现状（代码依据）

### 4.1 Agent CLI 能否直接复用：可以，已有程序触发的一次性通道

自动化模块的「Agent 自动化」已经是「**程序主动把提示词交给 Agent CLI，等它完成，再拿结果**」：

- **接口**：[`shared/automation/types.ts` L36–41、L90–115](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/shared/automation/types.ts#L90-L115)：`AgentRuntimePort.start({ kind:'agent', agentId, cwd, prompt, sessionMode }, run)` → `AgentRunHandle { terminalId, completion: Promise<{ status, message, output, usage, session }> }`，以及 `stop(terminalId)`、`open(terminalId)`、`listAgents()`。
- **服务键**：[`automations/api.ts` L36 `AUTOMATION_AGENT_RUNTIME`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/automations/api.ts#L36)，由 agent 模块提供（[agent/manifest.ts](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/manifest.ts)，仅桌面端）。
- **实现**：[`agent/services/agent-runtime.ts` `TerminalAutomationRuntime`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/services/agent-runtime.ts)：
  - 检查 Agent 已启用、CLI 能找到（`resolveCli`）、工作目录在库内（`canonicalVaultCwd`，[canonical-cwd.ts](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/platform/desktop/history/canonical-cwd.ts)）、YOLO 权限已确认；
  - 按 CLI 传提示词（[L61–112 `automationArgs`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/services/agent-runtime.ts#L61-L112)，模式见 [automation-catalog.ts](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/core/launch/automation-catalog.ts)）：Claude Code / Codex / Pi / Grok 作为命令行参数（Grok 前面加 `--`）；OpenCode `--prompt`；Gemini `--prompt-interactive`；其他 CLI 等输入就绪后用括号粘贴（最多等 20 秒，L456）；
  - 在 PTY 终端里启动交互式 CLI（`kind: 'automation'`），用**原生 hook** 判断这一轮结束（[automation-hooks.ts](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/platform/desktop/hooks/automation-hooks.ts)：Claude Code / Codex / Gemini / Grok 写 hook 配置，Pi / OpenCode 装 NAND 扩展）；**不靠输出静默来猜完成**；
  - 结果：`message` = 完成事件里的 `last_assistant_message`，**截到最后 8000 字符**（L222–224）；`output` = 终端原始输出（带 ANSI 控制符），也是最后 8000 字符（L424）；`usage` = 运行前后原生会话用量的差额。
  - 手动触发会自动打开终端（L479），其他触发不打开，可以之后在 AI Agent 页里打开。
- **对外支持的 CLI**：[catalog.ts L192 `CORE_AGENT_IDS`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/core/launch/catalog.ts#L192)：Claude Code、Codex、Gemini、OpenCode、Pi、Grok（[docs/automation.md「Agent 能力边界」](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/docs/automation.md)）。
- **现有调用方**：[`automations/core/service.ts` L309–330](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/automations/core/service.ts#L309-L330)。

**直接复用时的限制（必须处理）：**

1. `start()` 要求传入完整的 `AutomationRun`，这是自动化的数据结构。新闻模块不应伪造自动化运行记录。
2. **读回结果的容量**：
   - `message` 只保留最后 8000 字符，一批 JSON 很容易超出；
   - hook 脚本读取事件输入时，超过 65536 字符会直接退出、不写事件（[automation-hooks.ts L27](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/platform/desktop/hooks/automation-hooks.ts#L27)）。所以如果模型最后一条回答太长，**完成事件可能根本收不到**，只能等超时或进程退出（这一点按代码推断，待验证）。
3. **不是所有 CLI 都带最后一条回答**：NAND 给 Pi 和 OpenCode 装的扩展，事件数据只有 `session_id` / `transcript_path` / `cwd`，没有 `last_assistant_message`（[native-extensions.ts](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/platform/desktop/hooks/native-extensions.ts)）。Claude Code / Codex / Gemini / Grok 的原生事件是否都带这个字段，**待逐个验证**。
4. **没有总超时**：除了输入就绪的 20 秒，运行本身没有截止时间。CLI 等权限确认时会一直挂着。
5. **提示词放在命令行参数里有长度上限**（Windows 整条命令行约 32K 字符；Linux 单个参数 128 KiB），「一大段提示词」需要控制长度或分批（待实测）。
6. 终端依赖 `nand-pty` 组件。目前 main 是 1.0.0，但 1.0.0 Release 不存在，组件下载 404（#135）。**新闻的 AI 部分依赖 #135 先修好。**

### 4.2 其他可复用的部分

| 需要 | NAND 已有 | 位置 |
|---|---|---|
| 新模块 | 模块契约、懒加载、`dispose` 释放 | [module-authoring.md](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/.agents/skills/dev/references/module-authoring.md)、[`app/contracts/module.ts` L8–9 `ModuleId` / `MODULE_IDS`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/contracts/module.ts#L8-L9)、[`app/manifests.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/manifests.ts) |
| 功能管理开关 | 模块开关按 `MODULE_IDS` 自动生成 | [`app/settings/app-schema.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/settings/app-schema.ts)、[`module-switch.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/settings/module-switch.ts) |
| 工作台独立页面（和 AI Agent 页同级） | `WORKBENCH_FEATURES` + `compose-workbench` 贡献（图标轨、导航子项、侧栏 panel、availability、`modulePage`） | [`app/contracts/workbench.ts` L4–20](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/contracts/workbench.ts#L4-L20)、[`compose-workbench.ts` L50–62（AI Agent 页的写法）](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/workbench/compose-workbench.ts#L50-L62) |
| 设置页 | `settingsPage` + `context.settings.bind(name, schema)`；工作台设置列表 | [`app/settings/nav.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/settings/nav.ts)、[`settings-categories.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/app/workbench/settings-categories.ts)、[settings-and-i18n.md](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/.agents/skills/dev/references/settings-and-i18n.md) |
| 首页小组件 | **目前没有跨模块注册入口**：侧栏小组件在 [`render-sidebar-widgets.ts` L183–290](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/home/ui/renderer/render-sidebar-widgets.ts#L183-L290) 里写死，卡片类型 `CardType` 也写死（[model.ts L432](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/home/core/board/types/model.ts#L432)）。并行的「首页看板重构」issue 计划建立统一的组件注册表，允许其他模块通过 `api.ts` 贡献组件 | 见五、(b) |
| 联网抓取 | Obsidian `requestUrl`（已用于天气、节假日、微信读书等） | [`weather-service.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/home/platform/widgets/weather-service.ts) |
| 打开原文 | NAND 内置浏览器 `BROWSER_OPEN` | [`browser/api.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/browser/api.ts) |
| 把新闻交给 Agent 会话继续聊 | `AGENT_SESSIONS.attachMaterial`（粘贴到输入框，不自动发送） | [`agent/api.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/api.ts) |
| 完成 / 失败通知 | `NOTIFICATION_INBOX.send`（带幂等 id） | [`notifications/api.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/notifications/api.ts) |
| 带合并与备份的 JSON 存储 | `JsonStore`（写前三方合并，保留 `.backup`） | [`shared/json-store.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/shared/json-store.ts)、[docs/data.md](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/docs/data.md) |

硬性规则（[dev skill](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/.agents/skills/dev/SKILL.md)、[ui skill](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/.agents/skills/ui/SKILL.md)）：

- 只注册现有两个视图类型，新闻是**工作台页面**；
- 模块之间只通过对方的 `api.ts` 交互；
- 用户内容放可见目录的 Markdown，配置和运行数据放 `.nand/`；
- 文案都走 `t()`，中英双语；
- Node / Electron 只在 `desktop/` 目录里用；
- 关闭模块后不留监听器、进程或 DOM。

### 4.3 重复 issue 检查

已查 `NAMEWTA/nand` 的 issue（2026-10-08 22:40 UTC+8）：目前 open 的只有 #124、#134、#135，**没有新闻 / 资讯 / RSS / 热点相关的 issue**。代码和文档里也没有新闻相关实现。

---

## 五、融入 NAND 的方案

新增一个功能模块 **`news`（新闻）**，和现有模块同一套契约：`manifest.ts`、`api.ts`、`module.ts`、`settings.ts`、`i18n.ts`，以及 `core/`（纯规则：判重、评分合成、热度、日报排序、提示词组装与解析）、`platform/desktop/`（抓取、调用 Agent）、`services/`、`ui/`。在 `MODULE_IDS` 里加 `news`，功能管理里自动出现开关。默认关闭还是开启由维护者决定。

### AI 调用：程序主动触发 → 组装长提示词 → 调用现有 Agent CLI → 读回结构化结果

#### 1. 在 agent 模块对外提供一个「一次性提示词」接口（复用现有运行时，不另起一套）

在 `agent/api.ts` 新增服务（名字待定，例如 `AGENT_PROMPT_RUNNER`）：

```ts
interface AgentPromptRequest {
  agentId: string;          // 只能是已启用的 CORE_AGENT_IDS
  cwd: string;              // 库内目录，默认库根
  prompt: string;
  title: string;            // 终端标题，如「新闻分析 3/5」
  timeoutMs: number;
  signal?: AbortSignal;
  reveal?: boolean;         // 是否自动打开终端，默认否
}
interface AgentPromptResult {
  status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'timeout';
  text: string;             // 最后一条回答的完整文本（见下文第 3 点）
  usage?: AgentUsage;
  terminalId: string;
  errorCode?: string;
}
```

- 内部复用 `TerminalAutomationRuntime` 的逻辑：CLI 解析、账号环境、权限检查、hook、按 CLI 传提示词、用量差额。**不新写进程管理**。
- 不需要 `AutomationRun`，不在自动化中心留下定义或运行记录。
- 加上**总超时**和取消：超时或取消时调用 `stop(terminalId)` 结束进程，并返回 `timeout` / `cancelled`。
- 拿到结果后**关闭这个终端**（交互式 CLI 回答完不会自己退出）。设置里提供「保留终端便于查看」选项。

#### 2. 一次刷新的流程

```
触发（见下文第 5 点）
 → 抓取：按信源并发（有上限）用 requestUrl 读 RSS / Atom / JSON Feed
 → 规范化：URL 规范化判重；内容哈希判修订；旧文（发现时已发布 > 48h）只归档
 → 程序规则预过滤（屏蔽词、长度、语言），不花 AI 额度
 → 分批：每批 N 条（默认 10–15，可调），每条截断正文，控制提示词总长
 → 每批组装一段长提示词：系统规则 + 读者画像 / 关注主题 + 评分标准 + 输出格式 + 材料（带 id）+ 最近 14 天候选事件列表
 → 调 AGENT_PROMPT_RUNNER（同一时间只跑一个）
 → 读回结果 → 校验 → 写入本地数据
 → 程序计算：总分、是否入选、归组、热度、今日要闻
 → 刷新新闻页和首页小组件；按设置发送通知
```

#### 3. 读回结果（建议 JSON）

- 提示词要求**只输出一个 JSON**，并用固定标记包起来，例如 `<<<NAND_NEWS_JSON ... NAND_NEWS_JSON>>>`，便于从混杂的文本里取出来。
- 建议的单条字段：
  ```json
  {"id":"m12","relevance":"PASS|BLOCK|UNKNOWN","itemType":"product_launch",
   "axes":{"sig":6,"nov":5,"cred":7,"reson":6,"act":5},
   "category":"products","tags":["产品更新","Agent"],
   "titleZh":"…","summaryZh":"…","reason":"…",
   "event":{"relation":"SAME_OCCURRENCE|SAME_STORY|UNRELATED|ROUNDUP","target":"e7","confidence":0.85}}
  ```
- **和 AIHOT 的一处差异**：AIHOT 让模型只输出一个总分，五维在模型心里算。NAND 建议让模型**输出五维整数，由程序按类型权重算总分**。这样权重能在设置里改、结果可解释，也避免模型算错。这个改动会影响评分行为，需要用样本对照验证。
- **读取通道**（按优先级）：
  1. **完成事件里的最后一条回答**：不需要额外文件权限。需要把 8000 字符截断改成可配置（新闻调用放宽，但要远低于 hook 的 64KB 上限），同时用分批控制输出长度。
  2. **原生会话记录兜底**：从 `transcript_path` / 会话记录里读最后一条回答。NAND 已经能解析 Claude / Codex / Gemini 的记录（[`core/history/parse.ts`](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/src/modules/agent/core/history/parse.ts)），需要扩展出「最后一条回答」；Pi / OpenCode 走这条路。
  3. **结果文件（可选）**：让 Agent 把 JSON 写到 `.nand/news/<device-id>/runs/<runId>/result.json`。容量不受限，但 CLI 需要写文件权限（YOLO 或 CLI 自己的放行规则）；手动权限模式下会停在确认上。
  - 不用终端原始输出解析：带 ANSI 控制符，又只保留 8000 字符。
- **校验**：
  - 结构校验；
  - `id` 必须属于本批，多出来的丢掉，缺的标记「待重试」；
  - 五维必须是 0–10 的整数；
  - `event.target` 必须在候选里。
  - 解析失败时**只修复一次**：同一会话追加「只返回 JSON」；仍失败就整批记为失败。

#### 4. 和定时任务（自动化）的区别

| | 自动化里的 Agent 任务 | 新闻刷新 |
|---|---|---|
| 谁触发 | 用户建的定义 + 计划时间 / cron | 新闻模块自己在需要时触发 |
| 留下什么 | `NAND/自动化/…/操作.md` + 运行历史 | 不建定义；新闻模块自己的运行记录 |
| 结果给谁 | 给人看（终端 / 通知） | **给程序解析**，变成新闻数据 |
| 终端 | 手动运行时打开 | 默认不打开；运行记录里可「打开终端」查看或处理权限确认 |

#### 5. 触发方式（不是定时任务）

- 新闻页或侧栏里的「立即刷新」按钮；
- 打开新闻页或小组件时，如果数据超过 N 分钟（设置项，默认 60）就自动刷新；
- 可选：Obsidian 启动后刷新一次。
- 按信源间隔只抓**到期**的信源（参考 AIHOT 的自适应间隔和失败退避）；没有新材料就不调用 Agent。
- 是否要「Obsidian 运行期间每 N 分钟检查一次」留给维护者决定。如果做，也是模块内部的计时器，不写进自动化中心。

#### 6. 失败与超时

- **调用前检查**：桌面端；agent 模块已开启；选中的 CLI 已启用并能找到；终端组件可用（#135）；YOLO 需要确认时提示去设置。不满足时，新闻页显示原因和「去设置」按钮，只展示已抓到的原始标题。
- **超时**：每批默认 10 分钟（可调）。超时后结束终端，这批记为「超时」，其他批照常。
- **等待确认**：如果 CLI 停在权限确认上（OpenCode 会发 `PermissionRequest`，其他 CLI 待验证），运行记录显示「需要处理」，可打开终端。
- **幂等**：分析结果按 `内容哈希 + 提示词版本 + Agent` 缓存。重试或重启不会重复花额度；改了提示词只影响新材料（和 AIHOT 一样）。
- **中断**：插件重启时，未完成的批次标记「中断」，不自动重放；下次刷新重新排队。
- **额度**：记录每次调用的用量（runtime 已有用量差额）；设置里加「每日最多调用次数」上限。超过就停止并提示（对应 AIHOT 的预算熔断）。
- 失败不改用户笔记，也不让新闻页整页报错。

### (a) 内容展示：点击后按需要展示

- 点击小组件或列表里的一条 → 打开新闻页的**详情**：
  - 中文标题、摘要、推荐理由、分数（悬停显示五维和类型）、分类 / 标签、信源与时间；
  - 同一事件的其他报道和进展时间线；
  - 「打开原文」：NAND 浏览器或系统浏览器；
  - 「收藏」「发送到 Agent 会话」「不感兴趣」。
- **按需展示**有三层：
  1. **视图**：精选 / 全部 / 热点 / 今日要闻；
  2. **筛选**：分类、标签、信源、最低分、关键词，可以保存成「我的视图」，例如「只看 Agent + ≥70 分」；
  3. **深入了解**（AI）：在某条或某个事件上点「深入了解」，程序把这个事件的所有报道和我的关注点组装成提示词交给 Agent CLI，生成背景 / 影响 / 时间线简报，存成 Markdown 笔记并在详情里展示。
- 「关注主题 / 读者画像」写进评分提示词，相当于 AIHOT 提示词里的「读者是谁」，让打分符合我的关注点。

### (b) 首页小组件

- 小组件类型：**热点榜 Top N**、**精选流**、**指定视图**（绑定一个「我的视图」）。
- 每个实例的配置：条数、视图、是否显示摘要、自动刷新阈值。
- 显示「更新于 xx 分钟前」和刷新按钮；正在分析时显示进度；新闻模块关闭时显示占位，并保留配置。
- 点击条目进入 (a) 的详情，点标题栏进入新闻页。
- **注册方式**：
  - 首选接入并行「首页看板重构」issue 里的统一组件注册表，由新闻模块通过自己的 `api.ts` 贡献组件；
  - 如果新闻先于重构落地，就在 `home/api.ts` 加一个最小的 `contributionPoint`（例如 `HOME_WIDGETS`：key、名称、图标、`render(host, ctx)`、`dispose`），由 `render-sidebar-widgets.ts` 收集。不要把新闻代码写进 home 模块。
  - 小组件读数据走 `news/api.ts` 的服务（`peek`，不顺带启动新闻模块）。

### (c) 独立界面：工作台「新闻」页

- 在 `WORKBENCH_FEATURES` 里加 `news`，图标轨顶部加一个入口，导航子项和 AI Agent 页同一种写法：今日 / 热点 / 全部 / 收藏 / 信源 / 运行记录。
- **第 ② 栏**：
  - 主操作「立即刷新」；
  - 分区：我的视图、分类、信源（带健康状态：正常 / 失败次数 / 落后）、最近运行；
  - 可搜索。
- **第 ③ 栏**：
  - **列表**：卡片或紧凑行，同一事件的多篇折成一组（「+N 家报道」）；
  - **热点榜**：排名、热度、趋势和涨幅、角标（突增 / 新 / 上升）、参与信源；
  - **事件详情**：时间线（最新 / 最早切换）、7 天热度曲线（每小时快照，首版可只在新闻页打开期间记录，待定）；
  - **今日要闻**：按日报公式排的前 12 条 + 快讯；
  - **运行记录**：每批的状态、耗时、用量、错误、「打开终端」。
- **收集**：收藏把条目保存为库里的 Markdown 笔记（见六）；收藏列表就是这些笔记，可以在笔记里写自己的批注。
- 页面状态（当前视图、筛选、选中条目）放在 `getState()` / `stateKeys` 里，分屏和重启后能恢复。
- 遵守 ui skill：Preact 渲染、设计系统组件和 token、键盘可达、三种宽度和深浅色。

### (d) 配置管理

所有配置放进设置的「新闻」分类（`settings/nav.ts` 加产品，`settings-categories.ts` 加名称和图标），用 `context.settings.bind('news', schema)` 存到 `.nand/config/settings.json`。设置清单见七。

---

## 六、数据模型与存储

### 6.1 数据模型（草案）

| 对象 | 主要字段 |
|---|---|
| `Source` 信源 | id、名称、类型（`rss` / `atom` / `jsonfeed`，后续 `web-list`）、URL、分级（T1 / T1_5 / T2 / 不参与精选）、参与方式（editorial / signal / isolated）、归属分组（用于判定「独立参与方」）、抓取间隔、启用、失败次数、最近成功时间 |
| `Material` 原始资料 | id、sourceId、规范化 URL、原标题、正文摘录、发布时间、发现时间、内容哈希、是否旧文归档 |
| `Analysis` 分析结果 | materialId、内容哈希、提示词版本、agentId、relevance、itemType、五维、总分（1 次或 2 次）、是否入选、分类 / 标签、中文标题 / 摘要 / 推荐理由、用量、时间 |
| `Event` 事件 | id、标题、成员（materialId + 关系 + 置信度）、首条时间、最新时间、代表稿 |
| `HeatSnapshot` | eventId、小时、热度、参与方数 |
| `Run` 运行记录 | id、触发方式、批次、状态、耗时、用量、错误码、terminalId |

### 6.2 存储位置（遵守 [docs/data.md](https://github.com/NAMEWTA/nand/blob/21f852bc2d91d60335f57a4bc38a1e663e8b05eb/docs/data.md)）

| 内容 | 位置 | 说明 |
|---|---|---|
| 设置（信源、权重、提示词、显示） | `.nand/config/settings.json` 的 `news` 命名空间 | 整个库共用 |
| 资料、分析、事件、热度、运行记录 | `.nand/news/<device-id>/*.json`（`JsonStore`） | 可重建的缓存，按设备分开，避免多设备同时写冲突；按「保留天数」清理（默认 30 天） |
| **收藏（收集）** | 可见目录的 Markdown，默认 `NAND/新闻/收藏/YYYY-MM-DD-<标题>.md` | frontmatter：`nand-type: news`、url、source、published、score、tags、event；正文：中文标题、摘要、推荐理由、原文链接、我的批注。会随 Obsidian Sync 同步，删了插件也还在 |
| 今日要闻 / 深入了解简报（可选） | `NAND/新闻/日报/YYYY-MM-DD.md`、`NAND/新闻/简报/…` | 设置里开启才写 |
| Agent 临时输入 / 输出（如果用结果文件） | `.nand/news/<device-id>/runs/<runId>/` | 按保留天数清理 |

- 收藏笔记的格式要有 golden 往返测试（dev skill 规则 6）。
- `.nand/` 不会经 Obsidian Sync 同步，这是现有规则：新闻缓存只在本机，收藏笔记会同步。

---

## 七、设置项清单（草案，默认值参考 AIHOT）

| 分组 | 设置项 | 默认 |
|---|---|---|
| 常规 | 打开新闻页时数据超过多少分钟自动刷新 | 60 |
| | 启动后刷新一次 | 关 |
| | 资料保留天数 | 30 |
| | 收藏目录 / 是否写今日要闻笔记 / 日报目录 | `NAND/新闻/收藏` / 关 / `NAND/新闻/日报` |
| | 完成 / 失败时通知 | 仅失败 |
| 信源 | 列表：增删改、启用、分级、参与方式、归属分组、抓取间隔、「试抓」按钮 | 空，提供几条示例可一键添加（待定） |
| | 自适应抓取间隔（15–60 分钟） | 开 |
| | OPML 导入 / 导出 | 后续 |
| 兴趣 | 读者画像 / 关注主题（写进提示词） | 空 |
| | 屏蔽词（程序预过滤） | 空 |
| | 分类表与标签白名单 | 内置一套通用分类 |
| AI | 使用哪个 Agent（只列已启用的 CLI） | 第一个已启用的 |
| | 工作目录（库内） | 库根 |
| | 每批条数 / 每条正文截断长度 | 12 / 1500 字符（待调） |
| | 每批超时 | 10 分钟 |
| | 每日最多调用次数 | 20（待定） |
| | 两次独立评分 | 关（额度翻倍，可选） |
| | 读取通道：完成事件 / 会话记录 / 结果文件 | 自动 |
| | 保留终端便于查看 | 关 |
| | 提示词模板（预筛与评分、写作、归组、深入了解）：可编辑、显示版本哈希、「恢复默认」 | 内置 |
| 权重 | 入选门槛 T1 / T1_5 / T2 | 60 / 65 / 76 |
| | 精选写法下限 `understandFloor` | 50 |
| | 类型权重表（7 类 × 5 维，每行和 = 10，保存时校验） | 同 3.3 ① |
| | 热度窗口 / 半衰期 / 最少参与方 / 榜单条数 | 48h / 24h / 2 / 10 |
| | 趋势对比间隔 / 上升阈值 / 突增阈值 | 6h / 15% / ≥3 且 ≥50% |
| | 今日要闻条数 / 快讯条数 / 每信源上限 / 记忆天数 | 12 / 10 / 2 / 7 |
| | 归组召回天数 / 字二元组门槛 / 关系置信度门槛 | 14 / 0.25 / 0.8 |

改了权重参数后，立即用已有分析结果重新计算排序，不重新调用 AI。

---

## 八、分阶段实施

1. **P0 研读与对照**：
   - 提交一份对照表：「AIHOT 能力 → 源码文件 / 函数 → NAND 落点 → 差异及原因 → 验证用例」，覆盖第三节全部规则；
   - 实测 6 个 CLI：完成事件是否带最后一条回答、长提示词在 argv / 粘贴方式下的上限、权限等待时的表现。
2. **P1 模块骨架与采集（不含 AI）**：
   - `news` 模块、功能管理开关、设置页（信源、常规）、工作台新闻页；
   - RSS / Atom / JSON Feed 抓取、URL 规范化、内容哈希、旧文归档、自适应间隔和失败退避；
   - 原始列表展示、收藏为 Markdown。
3. **P2 Agent 调用与评分**：
   - `AGENT_PROMPT_RUNNER`（复用运行时，加超时 / 取消 / 结果读取）；
   - 提示词模板、分批、JSON 解析和校验、修复重试、缓存；
   - 五维 × 类型权重、分级门槛、精选 / 全部；运行记录和用量上限。
4. **P3 事件与热度**：
   - 候选召回 + Agent 判断关系、事件合并、代表稿；
   - 热度公式、趋势和角标、热点榜、事件详情。
5. **P4 首页小组件与按需展示**：
   - 小组件（接注册表或临时 `contributionPoint`）；
   - 「我的视图」、深入了解简报、今日要闻（含可选笔记）、通知。
6. **P5 完善**：
   - OPML、网页列表信源、两次评分、7 天热度曲线；
   - 移动端只读（读收藏笔记和已同步的数据，不调 AI，待定）；
   - 用户文档 `docs/news.md`。

每个 PR 说明覆盖了对照表的哪些项、和 AIHOT 的差异、实测结果。

---

## 九、验收标准

**参考与许可**
- [ ] 有对照表，第三节列出的规则（五维权重、分级门槛、热度公式、趋势角标、日报排序、URL 判重、内容哈希、归组关系、抓取间隔）都有 NAND 落点或明确的不做理由。
- [ ] 没有整段复制 AIHOT 代码；改编的提示词或算法有来源注释，`NOTICE` 已更新；界面不出现 AIHOT 名字和 Logo。

**模块与设置**
- [ ] 功能管理里能开关「新闻」。关闭后没有计时器、监听器、终端进程或 DOM 残留；再打开能正常工作。
- [ ] 所有配置都在设置「新闻」分类里，中英双语，没有原始键名；改权重后排序立即更新，不重新调用 AI。

**采集**
- [ ] 同一篇带 `utm_*`、`www.`、结尾斜杠、fragment 的不同链接只算一条；正文改动产生新修订，未改动不重复分析。
- [ ] 新信源首次导入和发现时已超过 48 小时的资料不进「今天」。
- [ ] 信源失败会退避；连续失败的信源在侧栏标红；单个信源失败不影响其他信源。

**AI 调用（复用 Agent CLI）**
- [ ] 不另接模型 API；调用经 agent 模块的现有运行时（CLI 解析、账号、权限、hook），不在自动化中心产生定义或运行记录。
- [ ] Claude Code、Codex、Gemini、OpenCode、Pi、Grok 中，至少 Claude Code 和 Codex 用真实账号跑通「提示词 → 完成 → 读回 JSON → 入库」；其他 CLI 的支持情况写进文档。
- [ ] 输出超长、JSON 损坏、id 不符、超时、取消、CLI 未安装、模块关闭、终端组件不可用、等待权限确认，这些情况都有明确状态和提示，不卡在「分析中」。
- [ ] 同一材料在相同提示词版本下不会重复调用；插件重启不会自动重放。
- [ ] 每次调用的用量有记录；超过每日上限时停止并提示。

**排序与展示**
- [ ] 用固定样本做单元测试：总分 = 五维 × 类型权重；入选判断符合分级门槛；热度 = Σ 0.5^(Δh/24)（同一参与方只算一次）；趋势和角标阈值；今日要闻 `importance` 公式和每信源上限。
- [ ] 新闻页：精选 / 全部 / 热点 / 今日要闻 / 收藏 / 运行记录可切换；事件折叠和时间线正确；状态在分屏和重启后恢复。
- [ ] 点击小组件条目能打开对应详情；「我的视图」筛选生效；「深入了解」生成的简报能存成 Markdown 并展示。
- [ ] 首页能添加新闻小组件，多个实例分别配置；新闻模块关闭时显示占位、不丢配置。
- [ ] 收藏笔记格式有 golden 往返测试；删除插件后收藏笔记仍可读。

**工程**
- [ ] `pnpm run build`、`pnpm run lint`、`pnpm run lint:css`、`pnpm test:architecture`、`pnpm run check:bundle`（启动预算不变，新模块有自己的预算）都通过；`main.js` 已重建。
- [ ] 在真实 Obsidian 桌面端验证浅色 / 深色、三种宽度、键盘操作。

---

## 十、不做的事（非目标）

- 不搭服务端、数据库或队列，不做公开网站、RSS / API / MCP 输出、后台管理。
- 不直接调用模型 API、不保存模型密钥：AI 只通过已有的 Agent CLI。
- 首版不做 X、微信公众号、Jina 等需要密钥或付费的信源，也不做向量检索。
- 不把新闻刷新做成自动化中心里的定时任务，不用 cron。
- 不绕过 CLI 自己的登录、目录信任和权限确认；不默认开启 YOLO。
- 不自动全文转载：默认只存标题、摘要和原文链接（AIHOT 也是默认只显示摘要）。
- 不在本 issue 里重做首页看板；小组件注册方式以「首页看板重构」issue 为准。

**最终期望：吃透 AIHOT 的选题标准和热度算法，在 NAND 里用自己已经登录的 Agent CLI 做出一个本地的、可配置的新闻工作台。**


## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
