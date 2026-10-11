---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-02 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"dfec45b11d78296560406f2808cf3824b271ea803b59d8d1ff87e105d12327b1","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>","T-02 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:news-aihot:agent-structured-prompt-runner","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-news-aihot"
id: "T-02"
title: "复用 Agent 并可靠读回完整结构化答案"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-01"]
contract_ids: ["AC-006","AC-007"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/agent/manifest.ts</Path>","<Path>src/modules/agent/module.ts</Path>","<Path>src/modules/agent/services/agent-runtime.ts</Path>","<Path>src/modules/agent/services/prompt-runner.ts</Path>","<Path>src/modules/agent/platform/desktop/hooks/automation-hooks.ts</Path>","<Path>src/modules/agent/platform/desktop/hooks/native-extensions.ts</Path>","<Path>src/modules/agent/platform/desktop/history/last-assistant.ts</Path>","<Path>src/modules/agent/core/history/parse.ts</Path>","<Path>src/modules/news/services/analysis-service.ts</Path>","<Path>src/modules/news/ui/RunHistory.tsx</Path>","<Path>docs/news.md</Path>","<Path>docs/news.ZH.md</Path>","<Path>src/modules/agent/services/prompt-runner.test.ts</Path>","<Path>src/modules/agent/platform/desktop/history/last-assistant.test.ts</Path>","<Path>src/modules/agent/platform/desktop/hooks/native-extensions.test.ts</Path>","<Path>src/modules/agent/core/history/parse.test.ts</Path>"]
writable_paths: ["<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/agent/manifest.ts</Path>","<Path>src/modules/agent/module.ts</Path>","<Path>src/modules/agent/services/agent-runtime.ts</Path>","<Path>src/modules/agent/services/prompt-runner.ts</Path>","<Path>src/modules/agent/platform/desktop/hooks/automation-hooks.ts</Path>","<Path>src/modules/agent/platform/desktop/hooks/native-extensions.ts</Path>","<Path>src/modules/agent/platform/desktop/history/last-assistant.ts</Path>","<Path>src/modules/agent/core/history/parse.ts</Path>","<Path>src/modules/news/services/analysis-service.ts</Path>","<Path>src/modules/news/ui/RunHistory.tsx</Path>","<Path>docs/news.md</Path>","<Path>docs/news.ZH.md</Path>","<Path>src/modules/agent/services/prompt-runner.test.ts</Path>","<Path>src/modules/agent/platform/desktop/history/last-assistant.test.ts</Path>","<Path>src/modules/agent/platform/desktop/hooks/native-extensions.test.ts</Path>","<Path>src/modules/agent/core/history/parse.test.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-news-aihot::T-02（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-news-aihot::T-02（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-02: 复用 Agent 并可靠读回完整结构化答案

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-02.md](../evidence/T-02.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/02-agent-structured-prompt-runner.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 新闻可通过公开runner发送一段prompt，得到完整最后答案及用量；用户能处理权限、取消和超时。

**规划时基线：** runtime要求AutomationRun、message尾8000、hook stdin65536字符和spool100000bytes上限；Pi/OpenCode无last message，旧history parser不输出最后assistant；PermissionRequest未消费。依赖终端change的helper验收及home公共Agent目录contract。

**来源：** AC-006, AC-007；issue #136；<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

抽取共享执行入口保留automation adapter，news不伪造AutomationRun。新AGENT_PROMPT_RUNNER与home公共目录/派发不重名；先逐CLI探针再实现能力驱动完整输出reader。completion元数据不可因大text静默丢失，明确oversize。总timeout/AbortSignal停止实际terminal，resultChannel基于能力，file仅显式选择，不用ANSI猜测。默认结束关闭专用terminal，keepTerminal仍属于news资源。 AGENT_PROMPT_RUNNER另支持可选runContext:{provider,handle}，AGENT_RUN_CONTEXTS贡献点仅由受信模块注册resolver，将opaque handle转换为短期env与dispose；不接受任意用户env，不保存或日志输出env/token。provider缺席/句柄失效在启动前拒绝。resolver在实际runId/cwd就绪后解析并绑定，finally/取消/卸载一定释放。news普通分析不传runContext。这是既有contribution机制中的小型执行上下文端口，不新增进程管理器或调度器。 短期runContext env只能在最终host.create/spawn合并，不能混入accountEnv、accountKey、持久session/history、hook配置或receipt；保持现有账户身份算法。即使keepTerminal=true，业务完成/取消/timeout也立即dispose授权，不能随终端保留。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 新闻可通过公开runner发送一段prompt，得到完整最后答案及用量；用户能处理权限、取消和超时。 | ModuleContext lifetime/settings/services/contributions、ModuleRegistry、现有两个view types、NativeSurface/PageCreate/stateKeys。; home统一组件注册表和公共Agent目录/派发contract；agent现有CLI解析、账户环境、canonicalVaultCwd、PTY会话、native hooks、原生用量。; AGENT_SESSIONS.attachMaterial（只粘贴不发送）、BROWSER_OPEN、NOTIFICATION_INBOX及NOTIFICATION_OPENERS。; JsonStore/三方合并/写队列/backup、现有vault文档写入及golden样本；requestUrl；Preact/primitives/tokens及t(en/zh)。 | 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。; 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。; 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。; 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。; 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。 |

## 4. 要构建什么

新闻可通过公开runner发送一段prompt，得到完整最后答案及用量；用户能处理权限、取消和超时。

抽取共享执行入口保留automation adapter，news不伪造AutomationRun。新AGENT_PROMPT_RUNNER与home公共目录/派发不重名；先逐CLI探针再实现能力驱动完整输出reader。completion元数据不可因大text静默丢失，明确oversize。总timeout/AbortSignal停止实际terminal，resultChannel基于能力，file仅显式选择，不用ANSI猜测。默认结束关闭专用terminal，keepTerminal仍属于news资源。 AGENT_PROMPT_RUNNER另支持可选runContext:{provider,handle}，AGENT_RUN_CONTEXTS贡献点仅由受信模块注册resolver，将opaque handle转换为短期env与dispose；不接受任意用户env，不保存或日志输出env/token。provider缺席/句柄失效在启动前拒绝。resolver在实际runId/cwd就绪后解析并绑定，finally/取消/卸载一定释放。news普通分析不传runContext。这是既有contribution机制中的小型执行上下文端口，不新增进程管理器或调度器。 短期runContext env只能在最终host.create/spawn合并，不能混入accountEnv、accountKey、持久session/history、hook配置或receipt；保持现有账户身份算法。即使keepTerminal=true，业务完成/取消/timeout也立即dispose授权，不能随终端保留。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 抽取共享执行入口保留automation adapter，news不伪造AutomationRun。新AGENT_PROMPT_RUNNER与home公共目录/派发不重名；先逐CLI探针再实现能力驱动完整输出reader。completion元数据不可因大text静默丢失，明确oversize。总timeout/AbortSignal停止实际terminal，resultChannel基于能力，file仅显式选择，不用ANSI猜测。默认结束关闭专用terminal，keepTerminal仍属于news资源。 AGENT_PROMPT_RUNNER另支持可选runContext:{provider,handle}，AGENT_RUN_CONTEXTS贡献点仅由受信模块注册resolver，将opaque handle转换为短期env与dispose；不接受任意用户env，不保存或日志输出env/token。provider缺席/句柄失效在启动前拒绝。resolver在实际runId/cwd就绪后解析并绑定，finally/取消/卸载一定释放。news普通分析不传runContext。这是既有contribution机制中的小型执行上下文端口，不新增进程管理器或调度器。 短期runContext env只能在最终host.create/spawn合并，不能混入accountEnv、accountKey、持久session/history、hook配置或receipt；保持现有账户身份算法。即使keepTerminal=true，业务完成/取消/timeout也立即dispose授权，不能随终端保留。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-01；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 记录六CLI真实版本/安装/账号可用性，最少Claude和Codex实测prompt→native stop→完整JSON；测长argv、中文结果字节、权限等待。
2. 与home-owner公共目录/派发接口对齐，新增news所需runner request/result/status API。
3. 抽取agent-runtime共享执行内核，保持automation旧start签名与状态行为。 接入可选runContext解析生命周期，provider缺席拒绝；用最短fake provider验证取消和失败时dispose，token不进入receipt。
4. 按探针扩hook元数据与native-last-answer读回、完整text容量合同和明确oversize。
5. 接总超时/取消/needs-attention/保留终端，news运行记录可打开终端。
6. 写真实支持矩阵和针对性runtime契约回归，不宣称未测CLI可用。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 回归 | pnpm vitest run src/modules/automations/automation.test.ts src/modules/agent/platform/desktop/hooks/native-extensions.test.ts src/modules/agent/core/history/parse.test.ts src/modules/agent/services/prompt-runner.test.ts src/modules/agent/platform/desktop/history/last-assistant.test.ts；仅针对新增runner状态/完整答案读回补co-located风险用例。 | 自动化既有契约不变、hook/完整text/终态可判。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> |
| 真实账号 | 在测试vault分别以Claude/Codex真实账号发送含多条JSON任务并读取>8000字符有效结果；另验证Gemini/OpenCode/Pi/Grok真实能力并记录未测项。 | 至少两必测CLI完整结果入库，native结束不凭静默，明确每CLI版本/通道。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> |
| 失败/宿主 | 真实Obsidian权限等待→打开终端，手动取消、10分钟可调测试超时、news/agent关闭、缺helper/CLI。 | 状态可处理或终结，所属进程停止，其他手动terminal不受影响。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> |
| 受限运行上下文泄漏或失效 | 定向prompt-runner seam用provider分配临时标记、抛错/timeout/cancel与重复handle，再检查spawn argv/env/receipt | 仅授权run收到env；失效不启动；finally恰好撤回；日志/持久数据无标记 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实Obsidian桌面用户闭环并记录未实测平台。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

本功能无既有news数据迁移；禁用news停止新增副作用并保留JSON与Markdown。回退代码不得删除用户笔记，旧CLI/automation接口保持兼容。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-006**：至少Claude/Codex真实完整回读入库；其余实测支持/未测限制逐项记录；无模型API与automation定义/run
- [ ] **AC-007**：全部返回明确终态或needs-attention，权限能打开terminal；不永久分析中；timeout结束真实进程；默认完成关闭自有terminal
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
