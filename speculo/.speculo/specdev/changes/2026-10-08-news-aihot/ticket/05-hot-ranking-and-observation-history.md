---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-05 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-05 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:news-aihot:hot-ranking-and-observation-history","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-news-aihot"
id: "T-05"
title: "展示可信热点趋势与七天曲线"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-04"]
contract_ids: ["AC-015","AC-016","AC-017"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/news/core/heat.ts</Path>","<Path>src/modules/news/services/news-service.ts</Path>","<Path>src/modules/news/platform/store.ts</Path>","<Path>src/modules/news/settings.ts</Path>","<Path>src/modules/news/ui/HotList.tsx</Path>","<Path>src/modules/news/ui/HeatChart.tsx</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/styles/news.css</Path>","<Path>src/modules/news/core/heat.test.ts</Path>"]
writable_paths: ["<Path>src/modules/news/core/heat.ts</Path>","<Path>src/modules/news/services/news-service.ts</Path>","<Path>src/modules/news/platform/store.ts</Path>","<Path>src/modules/news/settings.ts</Path>","<Path>src/modules/news/ui/HotList.tsx</Path>","<Path>src/modules/news/ui/HeatChart.tsx</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/styles/news.css</Path>","<Path>src/modules/news/core/heat.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/news/services/news-service.ts</Path>","<Path>src/modules/news/settings.ts</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-news-aihot::T-05（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-news-aihot::T-05（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/news/services/news-service.ts</Path> => 2026-10-08-news-aihot::T-05（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/settings.ts</Path> => 2026-10-08-news-aihot::T-05（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/ui/EventDetail.tsx</Path> => 2026-10-08-news-aihot::T-05（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-05: 展示可信热点趋势与七天曲线

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-05.md](../evidence/T-05.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/05-hot-ranking-and-observation-history.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 读者看到按独立参与方计算的热点、可比趋势和真实观测曲线，能理解尚无趋势的原因。

**规划时基线：** 无news热度/历史；AIHOT算法依赖source当前角色/owner、可靠原文时间与cohort，不能按文章数冒充。

**来源：** AC-015, AC-016, AC-017；issue #136；<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

48h窗口开下界闭上界、24h半衰期、heatIndex10倍、最少2参与1editorial、Top10；author/group/owner/source归并；趋势按6h前自己的窗口剔除late/stale cohort；up10%与rising15%分别处理；surge/new规则独立。hour snapshots仅实际观测，不完整留缺口，>=3点可绘，7d可比cohort，键盘点选。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 读者看到按独立参与方计算的热点、可比趋势和真实观测曲线，能理解尚无趋势的原因。 | ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。; home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。; AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。; JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。 | 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。; 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。; 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。; 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。; 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。 |

## 4. 要构建什么

读者看到按独立参与方计算的热点、可比趋势和真实观测曲线，能理解尚无趋势的原因。

48h窗口开下界闭上界、24h半衰期、heatIndex10倍、最少2参与1editorial、Top10；author/group/owner/source归并；趋势按6h前自己的窗口剔除late/stale cohort；up10%与rising15%分别处理；surge/new规则独立。hour snapshots仅实际观测，不完整留缺口，>=3点可绘，7d可比cohort，键盘点选。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 48h窗口开下界闭上界、24h半衰期、heatIndex10倍、最少2参与1editorial、Top10；author/group/owner/source归并；趋势按6h前自己的窗口剔除late/stale cohort；up10%与rising15%分别处理；surge/new规则独立。hour snapshots仅实际观测，不完整留缺口，>=3点可绘，7d可比cohort，键盘点选。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-04；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 实现参与者身份和eligible evidence规则，source设置变化即重算。
2. 实现raw heat/index/ranking与固定时钟趋势/cohort/角标。
3. 保存小时snapshot/coverage与ruleVersion，在模块授权生命周期内定时本地计算，清理过期但不伪造停机小时。
4. 实现热点排名、参与者、趋势说明及事件HeatChart范围/键盘。
5. 用确定数字样本核对边界并做真实三宽度展示。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 公式 | 新增core/heat.test.ts后 pnpm vitest run src/modules/news/core/heat.test.ts。 | t=0与24h两个参与raw1.5/index15，重复不增、48h边界、late/stale未知与阈值正确。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path> |
| UI宿主 | 真实Obsidian使用有缺口的7日fixture，查看24h/3d/7d、左右/esc点选、小屏深浅和reduced-motion。 | 缺失小时不降0，少于3点显示解释，键盘可读。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实Obsidian桌面用户闭环并记录未实测平台。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

本功能无既有news数据迁移；禁用news停止新增副作用并保留JSON与Markdown。回退代码不得删除用户笔记，旧CLI/automation接口保持兼容。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-015**：每参与方最新原文时间一次；48h/24h公式、heatIndex、2参与+1editorial、Top10稳定；设置变化立即重算
- [ ] **AC-016**：new/up/down/flat/unknown正确；>10%方向、>15%rising、surge≥3且≥50%；late/stale不造涨幅
- [ ] **AC-017**：未观测不补0、少于3点不画、完整小时可比cohort；曲线标真实范围，键盘左右/esc有效
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
