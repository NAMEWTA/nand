---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-04 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-04 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:kimi-workspace-poc","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-04"
title: "交付 Kimi 真实单站闭环 PoC"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-03"]
contract_ids: ["AC-013","AC-007","AC-016","AC-026"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/core/providers/kimi.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/kimi.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/kimi.test.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/fixtures/kimi.json</Path>","<Path>src/modules/browser/core/providers/registry.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
writable_paths: ["<Path>src/modules/browser/core/providers/kimi.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/kimi.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/kimi.test.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/fixtures/kimi.json</Path>","<Path>src/modules/browser/core/providers/registry.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/core/providers/registry.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-04（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-04（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/core/providers/registry.ts</Path> => 2026-10-08-browser-ai-workbench::T-04（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/i18n.ts</Path> => 2026-10-08-browser-ai-workbench::T-04（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-04: 交付 Kimi 真实单站闭环 PoC

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-04.md](../evidence/T-04.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/04-kimi-workspace-poc.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** Kimi在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。

**规划时基线：** NAND没有Kimi adapter；复用T-03契约，固定MAIW provider目录提供richtext composer、list messages分页与终止、消息链和生成终态参考，不包含宿主实测。

**来源：** AC-013, AC-007, AC-016, AC-026；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

不得创建第二workspace/queue或专站持久层。providerId=kimi，readiness/stage/commit/acquire/newConversation语义同DeepSeek；重点richtext composer、list messages分页与终止、消息链和生成终态。仅启用验证过的来源，message/branch/分页不明确就incomplete，site challenge可接管不绕过。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| Kimi在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

Kimi在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。

不得创建第二workspace/queue或专站持久层。providerId=kimi，readiness/stage/commit/acquire/newConversation语义同DeepSeek；重点richtext composer、list messages分页与终止、消息链和生成终态。仅启用验证过的来源，message/branch/分页不明确就incomplete，site challenge可接管不绕过。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 不得创建第二workspace/queue或专站持久层。providerId=kimi，readiness/stage/commit/acquire/newConversation语义同DeepSeek；重点richtext composer、list messages分页与终止、消息链和生成终态。仅启用验证过的来源，message/branch/分页不明确就incomplete，site challenge可接管不绕过。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-03；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 逐文件读MAIW固定 src/providers/kimi/ definition/selectors/strategy/acquisition/runtime-acquisition/native-copy 和 上游 kimi list-messages page-1/page-2；记录实际host allowlist与支持策略。
2. 实现Kimi desktop adapter与纯身份/内容规范化，接入registry以及用户可辨目标；输入必须readback。
3. 用上游 kimi list-messages page-1/page-2经去敏感最小转换构造有价值的当前轮/完整性回归；注明源SHA与许可，不能copy整框架。
4. 真实账号在受控Obsidian跑三轮/重复问题/新task/长答案；记录提交接受、关联、完整性与人工介入。
5. 相关test/build/lint/architecture通过，更新该provider真实证据；不因fixture通过宣称站点通过。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 站点契约 | 新增 kimi.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/kimi.test.ts | richtext composer、list messages分页与终止、消息链和生成终态边界正确；旧轮/缺页/非终态不false complete。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path> |
| 真实站点 | Obsidian已登录Kimi：连续3轮、长答案、新会话、至少一次受控单站失败及人工接管 | 当前目标提交/采集和Markdown可查，失败未自动重发。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: Kimi真实登录PoC，不是只加载官网。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

只新增明确version的数据与可选入口，保持旧普通浏览器/default profile兼容；回滚代码前停新任务、导出用户Markdown，保留未知字段和journal，不回滚官网已提交事实。错误以明确reason/状态呈现，不自动重发。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-013**：正确会话/消息链、分页到终止或明确incomplete、当前轮Markdown；提交与采集证据可查
- [ ] **AC-007**：逐target执行并验证真正新官网上下文；仅home URL不算成功；保留旧任务；失败目标显式阻止提交
- [ ] **AC-016**：选单个合格来源；source/version/identity可查；heading/table/code/math保存；空/title/status-only、缺页或无终态不标complete；原生copy不污染剪贴板
- [ ] **AC-026**：仅该provider allowlist/该task采必要字段；token/cookie/password被剔除，默认无全网HAR；卸载或取消移除hook
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
