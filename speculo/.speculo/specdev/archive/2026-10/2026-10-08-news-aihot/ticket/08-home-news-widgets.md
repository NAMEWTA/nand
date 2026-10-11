---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-08 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"add18e61df97494df0d6f0ab45a5920bc0132779e6a33d53bc6c41ff1b701aab","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-08 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:news-aihot:home-news-widgets","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-news-aihot"
id: "T-08"
title: "在首页添加独立新闻小组件实例"
status: "done"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: ["T-06"]
contract_ids: ["AC-023"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/news/api.ts</Path>","<Path>src/modules/news/contrib/home-widgets.ts</Path>","<Path>src/modules/news/module.ts</Path>","<Path>src/modules/news/ui/widgets/NewsWidget.tsx</Path>","<Path>src/modules/news/ui/widgets/settings.ts</Path>","<Path>src/modules/news/styles/news.css</Path>","<Path>src/modules/news/contrib/home-widgets.test.ts</Path>"]
writable_paths: ["<Path>src/modules/news/api.ts</Path>","<Path>src/modules/news/contrib/home-widgets.ts</Path>","<Path>src/modules/news/module.ts</Path>","<Path>src/modules/news/ui/widgets/NewsWidget.tsx</Path>","<Path>src/modules/news/ui/widgets/settings.ts</Path>","<Path>src/modules/news/styles/news.css</Path>","<Path>src/modules/news/contrib/home-widgets.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/news/api.ts</Path>","<Path>src/modules/news/module.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-news-aihot::T-08（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-news-aihot::T-08（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/news/api.ts</Path> => 2026-10-08-news-aihot::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/news/module.ts</Path> => 2026-10-08-news-aihot::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-08: 在首页添加独立新闻小组件实例

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-08.md](../evidence/T-08.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/08-home-news-widgets.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户在统一首页组件库添加热点、精选、我的视图新闻组件，并能独立配置与导航。

**规划时基线：** 当前home没有registry，此票外部依赖home领域统一组件注册表；不允许同时建临时HOME_WIDGETS。

**来源：** AC-023；issue #136；<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

三widget kind，共用news读service peek不启用模块；instance持久化由home契约拥有，news只定义config/renderer。contrib层不import ui，module.ts传lazy renderer loader。禁用news撤销贡献后home显示保留kind/config占位；UI刷新按钮/opt-in stale走共享service去重，widget销毁只撤订阅不杀用户全局刷新。 真实功能依赖为news基础/热点/saved-view查询合同，T-06传递覆盖T-01至T-05，不依赖brief。src/modules/home/api.ts只读消费，注册入口与instance持久化的唯一写入owner为home change。 HOME_WIDGETS一次贡献provider bundle {kinds:[raw,hot,view]}（最终kind key按Spec），不能为三个kind分别注册同point；按provider+kind唯一键查找。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户在统一首页组件库添加热点、精选、我的视图新闻组件，并能独立配置与导航。 | ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。; home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。; AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。; JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。 | 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。; 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。; 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。; 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。; 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。 |

## 4. 要构建什么

用户在统一首页组件库添加热点、精选、我的视图新闻组件，并能独立配置与导航。

三widget kind，共用news读service peek不启用模块；instance持久化由home契约拥有，news只定义config/renderer。contrib层不import ui，module.ts传lazy renderer loader。禁用news撤销贡献后home显示保留kind/config占位；UI刷新按钮/opt-in stale走共享service去重，widget销毁只撤订阅不杀用户全局刷新。 真实功能依赖为news基础/热点/saved-view查询合同，T-06传递覆盖T-01至T-05，不依赖brief。src/modules/home/api.ts只读消费，注册入口与instance持久化的唯一写入owner为home change。 HOME_WIDGETS一次贡献provider bundle {kinds:[raw,hot,view]}（最终kind key按Spec），不能为三个kind分别注册同point；按provider+kind唯一键查找。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 三widget kind，共用news读service peek不启用模块；instance持久化由home契约拥有，news只定义config/renderer。contrib层不import ui，module.ts传lazy renderer loader。禁用news撤销贡献后home显示保留kind/config占位；UI刷新按钮/opt-in stale走共享service去重，widget销毁只撤订阅不杀用户全局刷新。 真实功能依赖为news基础/热点/saved-view查询合同，T-06传递覆盖T-01至T-05，不依赖brief。src/modules/home/api.ts只读消费，注册入口与instance持久化的唯一写入owner为home change。 HOME_WIDGETS一次贡献provider bundle {kinds:[raw,hot,view]}（最终kind key按Spec），不能为三个kind分别注册同point；按provider+kind唯一键查找。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-06；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 读取已交付home公开registry/API合同并确认instance schema/unknown-kind占位支持，不改home内部switch。
2. 在news API声明只读snapshot与订阅/导航动作，配置稳定viewId。
3. module.ts一次装配含三kind的provider bundle与lazy UI renderer，避免每point每module覆盖；contrib不导入UI。
4. 实现三type与每实例count/view/summary/staleThreshold，真实更新时间/进度。
5. 验证禁用占位、恢复、多个实例与准确detail深链。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 架构 | 补co-located src/modules/news/contrib/home-widgets.test.ts，运行 pnpm vitest run src/modules/news/contrib/home-widgets.test.ts && pnpm test:architecture && pnpm run check:bundle；消费home registry已有contract，用最小案例验证news贡献配置独立、只读不启模块和dispose注销。 | 无cross-module internals、无contrib→ui越区，startup不加载newsUI。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path> |
| 真实首页 | 真实Obsidian同board放热点和两个不同saved-view实例，改一份config→点击条目→news off/on。 | 实例互不影响，深链准确，off占位保留且不自动activate，on恢复。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实Obsidian桌面用户闭环并记录未实测平台。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

本功能无既有news数据迁移；禁用news停止新增副作用并保留JSON与Markdown。回退代码不得删除用户笔记，旧CLI/automation接口保持兼容。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-023**：配置分别生效、更新/分析进度准确、条目深链正确；news off占位保配置且peek不启用；恢复重新读
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
