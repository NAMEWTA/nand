---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-03 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-03 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:news-aihot:featured-analysis-and-receipts","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-news-aihot"
id: "T-03"
title: "批量分析精选并控制额度"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-02"]
contract_ids: ["AC-008","AC-009","AC-010","AC-011","AC-012"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/news/core/prompts.ts</Path>","<Path>src/modules/news/core/analysis.ts</Path>","<Path>src/modules/news/core/scoring.ts</Path>","<Path>src/modules/news/services/analysis-service.ts</Path>","<Path>src/modules/news/platform/store.ts</Path>","<Path>src/modules/news/settings.ts</Path>","<Path>src/modules/news/ui/NewsPage.tsx</Path>","<Path>src/modules/news/ui/RunHistory.tsx</Path>","<Path>src/modules/news/ui/AnalysisDetail.tsx</Path>","<Path>src/modules/news/ui/settings-page.ts</Path>","<Path>src/modules/news/core/scoring.test.ts</Path>","<Path>src/modules/news/core/analysis.test.ts</Path>","<Path>src/modules/news/services/analysis-service.test.ts</Path>"]
writable_paths: ["<Path>src/modules/news/core/prompts.ts</Path>","<Path>src/modules/news/core/analysis.ts</Path>","<Path>src/modules/news/core/scoring.ts</Path>","<Path>src/modules/news/services/analysis-service.ts</Path>","<Path>src/modules/news/platform/store.ts</Path>","<Path>src/modules/news/settings.ts</Path>","<Path>src/modules/news/ui/NewsPage.tsx</Path>","<Path>src/modules/news/ui/RunHistory.tsx</Path>","<Path>src/modules/news/ui/AnalysisDetail.tsx</Path>","<Path>src/modules/news/ui/settings-page.ts</Path>","<Path>src/modules/news/core/scoring.test.ts</Path>","<Path>src/modules/news/core/analysis.test.ts</Path>","<Path>src/modules/news/services/analysis-service.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/news/settings.ts</Path>","<Path>src/modules/news/ui/settings-page.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-news-aihot::T-03（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-news-aihot::T-03（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/news/settings.ts</Path> => 2026-10-08-news-aihot::T-03（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/ui/settings-page.ts</Path> => 2026-10-08-news-aihot::T-03（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-03: 批量分析精选并控制额度

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/03-featured-analysis-and-receipts.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 一次授权刷新产生可解释的中文精选与全部列表，拥有可靠批次结果、预算与重启行为。

**当前事实：** 采集与runner可用后仍无news结构化输出/评分/receipt；AIHOT各步骤独立调用，本方案按batch重写并输出axes，须记录差异。

**来源：** AC-008, AC-009, AC-010, AC-011, AC-012；issue #136；<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

默认12条/1500正文，受CLI实测输入输出cap限制；一批一个调用，同刻1批。schema验证id/axes/target，最多一次同会话format repair，所有实际发送计20/day。原始返回先持久化后应用；interrupted unknown只手动重试。7类五维及质量cap程序计算、双评分默认关、第二次独立不带前分；threshold与strict >50合同；prompt/兴趣hash新材料生效；调权重0AI。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 一次授权刷新产生可解释的中文精选与全部列表，拥有可靠批次结果、预算与重启行为。 | ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。; home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。; AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。; JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。 | 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。; 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。; 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。; 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。; 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。 |

## 4. 要构建什么

一次授权刷新产生可解释的中文精选与全部列表，拥有可靠批次结果、预算与重启行为。

默认12条/1500正文，受CLI实测输入输出cap限制；一批一个调用，同刻1批。schema验证id/axes/target，最多一次同会话format repair，所有实际发送计20/day。原始返回先持久化后应用；interrupted unknown只手动重试。7类五维及质量cap程序计算、双评分默认关、第二次独立不带前分；threshold与strict >50合同；prompt/兴趣hash新材料生效；调权重0AI。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 默认12条/1500正文，受CLI实测输入输出cap限制；一批一个调用，同刻1批。schema验证id/axes/target，最多一次同会话format repair，所有实际发送计20/day。原始返回先持久化后应用；interrupted unknown只手动重试。7类五维及质量cap程序计算、双评分默认关、第二次独立不带前分；threshold与strict >50合同；prompt/兴趣hash新材料生效；调权重0AI。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-02；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 确定有效prompt版本和batch结果schema，合入上游安全边界/评分品味/structure/frame与写作规则，记录SHA归因。
2. 实现输出包围标记提取/严格字段验证、partial id与一次修复，不新增多模型回退。
3. 实现axes与cap单/双评分、tier门槛及understand写法，保存原始维度。
4. 实现receipt先写、收到先存、恢复消费、unknown手动重试和每日调用ledger。
5. 接兴趣/AI/权重/template设置、精选与全部、维度查看/运行错误与进度。
6. 用小型已标注材料对照合批轴输出差异，并真实刷新一批贯通。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 领域/失败 | 新增co-located core/scoring.test.ts、analysis.test.ts、services/analysis-service.test.ts（服务先例src/modules/notifications/core/service.test.ts），运行 pnpm vitest run src/modules/news。 | 权重门槛边界、1次repair、invalid id、quota、received/restart契约通过；不写镜像UI测试。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path> |
| 真实功能 | 测试vault设置12条材料/每日预算2，刷新→看到精选/全部与维度→改权重→尝试第3次调用→重启未知批次。 | 分数与展示重算，修改权重不新调用，上限停止，中断未知不自动重放。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实Obsidian桌面用户闭环并记录未实测平台。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

本功能无既有news数据迁移；禁用news停止新增副作用并保留JSON与Markdown。回退代码不得删除用户笔记，旧CLI/automation接口保持兼容。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-008**：结构约束有效；未知id忽略、缺id待重试；只1次修复；仍坏failed，不将ANSI截尾当答案
- [ ] **AC-009**：已完成/received不再次调用；启动未知interrupted只手动重试；未启动可继续；结果先落盘再应用
- [ ] **AC-010**：每次真实发送都计数，达到20停止提示；无新资料0调用；unknown usage不显示0成本
- [ ] **AC-011**：整数加权和及floor均值正确；sum门槛60/65/76；strict >50写法；质量cap生效；改权重立即重排0新调用
- [ ] **AC-012**：hash覆盖有效模板与依赖；新材料新版本，旧结果不自动重算；评分payload不含tier/source名/first-party
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
