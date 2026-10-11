---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-04 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-04 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:news-aihot:event-occurrences-and-representative","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-news-aihot"
id: "T-04"
title: "归组同一发生与后续事件"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-03"]
contract_ids: ["AC-013","AC-014"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/news/core/model.ts</Path>","<Path>src/modules/news/core/grouping.ts</Path>","<Path>src/modules/news/core/representative.ts</Path>","<Path>src/modules/news/core/prompts.ts</Path>","<Path>src/modules/news/services/analysis-service.ts</Path>","<Path>src/modules/news/platform/store.ts</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/ui/NewsPage.tsx</Path>","<Path>src/modules/news/core/grouping.test.ts</Path>","<Path>src/modules/news/core/representative.test.ts</Path>"]
writable_paths: ["<Path>src/modules/news/core/model.ts</Path>","<Path>src/modules/news/core/grouping.ts</Path>","<Path>src/modules/news/core/representative.ts</Path>","<Path>src/modules/news/core/prompts.ts</Path>","<Path>src/modules/news/services/analysis-service.ts</Path>","<Path>src/modules/news/platform/store.ts</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/ui/NewsPage.tsx</Path>","<Path>src/modules/news/core/grouping.test.ts</Path>","<Path>src/modules/news/core/representative.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/news/core/model.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-news-aihot::T-04（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-news-aihot::T-04（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/news/core/model.ts</Path> => 2026-10-08-news-aihot::T-04（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-04: 归组同一发生与后续事件

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-04.md](../evidence/T-04.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/04-event-occurrences-and-representative.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 读者看到重复报道折叠，同一事件后续进展清晰，点击代表新闻不会被爆料或无关汇总抢占。

**规划时基线：** 仅material分析不能表达AIHOT fact/story；需要occurrence层、关系候选和代表稿。

**来源：** AC-013, AC-014；issue #136；<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

14天发现窗口、title+summary300、字符bigram≥0.25、每occurrence最佳报告前10；批内也判重。四关系tie0.8、merge review0.75，ROUNDUP只mentions、SAME_STORY连root不链漂移；低信心留待确认。先选最多源occurrence再T1/owner匹配publisher/fulltext/score/time/id；合并保留alias。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 读者看到重复报道折叠，同一事件后续进展清晰，点击代表新闻不会被爆料或无关汇总抢占。 | ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。; home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。; AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。; JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。 | 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。; 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。; 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。; 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。; 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。 |

## 4. 要构建什么

读者看到重复报道折叠，同一事件后续进展清晰，点击代表新闻不会被爆料或无关汇总抢占。

14天发现窗口、title+summary300、字符bigram≥0.25、每occurrence最佳报告前10；批内也判重。四关系tie0.8、merge review0.75，ROUNDUP只mentions、SAME_STORY连root不链漂移；低信心留待确认。先选最多源occurrence再T1/owner匹配publisher/fulltext/score/time/id；合并保留alias。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 14天发现窗口、title+summary300、字符bigram≥0.25、每occurrence最佳报告前10；批内也判重。四关系tie0.8、merge review0.75，ROUNDUP只mentions、SAME_STORY连root不链漂移；低信心留待确认。先选最多源occurrence再T1/owner匹配publisher/fulltext/score/time/id；合并保留alias。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-03；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 新增Event内occurrences与mention/alias模型，扩source owner/publisher和analysis frame数据。
2. 实现纯候选recall与batch内部资料候选，生成bounded关系输入。
3. 解析四关系，处理低信心/ROUNDUP/已有事件merge复核并保留旧id。
4. 实现代表发生/稿件选择及同新闻+N源折叠。
5. 接事件详情overview/进展/报道时间线及正倒序，归组确认后刷新精选资格。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 领域 | 新增core/grouping.test.ts、representative.test.ts，运行 pnpm vitest run src/modules/news/core。 | 同次/跟进/独立版本/ROUNDUP/同批/低信心与代表边界确定。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path> |
| 真实阅读 | 测试vault导入官方发布、先发爆料、媒体转述、后续评测、两个独立发布的合集；查看折叠、进展和旧event深链。 | 合集不桥接，正式最多源发生代表正确，旧链接可恢复。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实Obsidian桌面用户闭环并记录未实测平台。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

本功能无既有news数据迁移；禁用news停止新增副作用并保留JSON与Markdown。回退代码不得删除用户笔记，旧CLI/automation接口保持兼容。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-013**：14天0.25 bigram前10；同发生合一、跟进根事件新occurrence、独立分开；ROUNDUP不桥接；低信心待确认；同批不重复开event
- [ ] **AC-014**：先最多源occurrence、平手早者，后authority/fulltext/score/time/id；旧event深链仍到合并后事件
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
