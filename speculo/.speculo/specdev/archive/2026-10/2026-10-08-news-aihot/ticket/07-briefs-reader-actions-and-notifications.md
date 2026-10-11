---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-07 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"add18e61df97494df0d6f0ab45a5920bc0132779e6a33d53bc6c41ff1b701aab","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-07 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:news-aihot:briefs-reader-actions-and-notifications","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-news-aihot"
id: "T-07"
title: "生成深入了解简报并连接阅读动作"
status: "done"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: ["T-04"]
contract_ids: ["AC-020","AC-022","AC-026"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/news/core/prompts.ts</Path>","<Path>src/modules/news/services/news-service.ts</Path>","<Path>src/modules/news/platform/notes.ts</Path>","<Path>src/modules/news/contrib/notifications.ts</Path>","<Path>src/modules/news/ui/BriefDetail.tsx</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/ui/AnalysisDetail.tsx</Path>","<Path>src/modules/news/api.ts</Path>","<Path>src/modules/news/module.ts</Path>","<Path>src/modules/news/services/news-service.test.ts</Path>","<Path>src/modules/news/platform/notes.test.ts</Path>","<Path>test/golden/user-formats.test.ts</Path>"]
writable_paths: ["<Path>src/modules/news/core/prompts.ts</Path>","<Path>src/modules/news/services/news-service.ts</Path>","<Path>src/modules/news/platform/notes.ts</Path>","<Path>src/modules/news/contrib/notifications.ts</Path>","<Path>src/modules/news/ui/BriefDetail.tsx</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/ui/AnalysisDetail.tsx</Path>","<Path>src/modules/news/api.ts</Path>","<Path>src/modules/news/module.ts</Path>","<Path>src/modules/news/services/news-service.test.ts</Path>","<Path>src/modules/news/platform/notes.test.ts</Path>","<Path>test/golden/user-formats.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/news/services/news-service.ts</Path>","<Path>src/modules/news/platform/notes.ts</Path>","<Path>src/modules/news/ui/EventDetail.tsx</Path>","<Path>src/modules/news/api.ts</Path>","<Path>src/modules/news/module.ts</Path>","<Path>test/golden/user-formats.test.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-news-aihot::T-07（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-news-aihot::T-07（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/news/services/news-service.ts</Path> => 2026-10-08-news-aihot::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/platform/notes.ts</Path> => 2026-10-08-news-aihot::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/ui/EventDetail.tsx</Path> => 2026-10-08-news-aihot::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/api.ts</Path> => 2026-10-08-news-aihot::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/module.ts</Path> => 2026-10-08-news-aihot::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>test/golden/user-formats.test.ts</Path> => 2026-10-08-news-aihot::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-07: 生成深入了解简报并连接阅读动作

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-07.md](../evidence/T-07.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/07-briefs-reader-actions-and-notifications.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户从新闻详情生成带来源简报、打开原文或送入现有Agent输入，并收到幂等完成/失败通知。

**规划时基线：** BROWSER_OPEN/AGENT_SESSIONS/NOTIFICATION_INBOX已可用；notification target当前automation形状，news不能伪造其字段。

**来源：** AC-020, AC-022, AC-026；issue #136；<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

详情展示摘要理由维度与原文；click原文经browser可用则打开，否则系统；attach仅粘贴。brief只依赖已分析事件/来源和关注点，经同runner/预算生成背景影响时间线并写可读Markdown，无需今日编排或saved-view；写失败不报成功。通过既有notifications API发送news:<runId>:<outcome>幂等id并注册news opener，opener从news自有运行索引解析目标；不扩展notification API、不伪造automation target、不重做inbox。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户从新闻详情生成带来源简报、打开原文或送入现有Agent输入，并收到幂等完成/失败通知。 | ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。; home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。; AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。; JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。 | 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。; 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。; 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。; 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。; 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。 |

## 4. 要构建什么

用户从新闻详情生成带来源简报、打开原文或送入现有Agent输入，并收到幂等完成/失败通知。

详情展示摘要理由维度与原文；click原文经browser可用则打开，否则系统；attach仅粘贴。brief只依赖已分析事件/来源和关注点，经同runner/预算生成背景影响时间线并写可读Markdown，无需今日编排或saved-view；写失败不报成功。通过既有notifications API发送news:<runId>:<outcome>幂等id并注册news opener，opener从news自有运行索引解析目标；不扩展notification API、不伪造automation target、不重做inbox。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 详情展示摘要理由维度与原文；click原文经browser可用则打开，否则系统；attach仅粘贴。brief只依赖已分析事件/来源和关注点，经同runner/预算生成背景影响时间线并写可读Markdown，无需今日编排或saved-view；写失败不报成功。通过既有notifications API发送news:<runId>:<outcome>幂等id并注册news opener，opener从news自有运行索引解析目标；不扩展notification API、不伪造automation target、不重做inbox。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-04；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 补详情reader actions与read/uninterested设备state，行为全部由显式按钮触发。
2. 新增brief prompt输入/输出合同及来源引用，复用runner receipt/quota。
3. 实现brief Markdown耐久写和详情展示，已有批注不覆盖。
4. 通过既有notifications API贡献news opener并按策略幂等send；news索引保存目标，不改变automation target或notification合同。
5. 走通真实CLI brief与系统/内置浏览器、Agent未发送输入。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 边界/回归 | 补co-located src/modules/news/services/news-service.test.ts 的brief流程失败/幂等场景及platform/notes.test.ts的管理区/批注边界，再运行 pnpm vitest run src/modules/news src/modules/notifications/core/service.test.ts src/modules/automations/automation.test.ts test/golden/user-formats.test.ts。 | Brief写入/通知幂等、原automation通知不变、notes用户内容保留。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path> |
| 真实用户 | 事件详情点击深入了解→真实CLI完成→查看Markdown→原文→选现有Agent接收；失败重复notify→点开。 | 来源完整且quota增加；Agent只粘贴未发，通知不重复，失败不改旧笔记。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实Obsidian桌面用户闭环并记录未实测平台。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

本功能无既有news数据迁移；禁用news停止新增副作用并保留JSON与Markdown。回退代码不得删除用户笔记，旧CLI/automation接口保持兼容。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-020**：中文标题摘要理由及来源可追溯，正倒序正确；隐藏选择生效；原文点击才打开；attachMaterial仅粘贴不发送
- [ ] **AC-022**：生成背景/影响/时间线且带来源链接；成功耐久写后显示保存完成，失败不覆盖已有笔记；计quota
- [ ] **AC-026**：幂等news-run id只送一次并打开相关新闻记录；notifications关闭不阻塞处理，不伪造automation target
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
