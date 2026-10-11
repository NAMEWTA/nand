---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-08 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-08 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:workspace-restart-recovery","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-08"
title: "可靠重启、人工恢复与保存失败闭环"
status: "done"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: ["T-07"]
contract_ids: ["AC-011","AC-017","AC-020","AC-023","AC-025","AC-039"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/platform/workspace-store.ts</Path>","<Path>src/modules/browser/core/workspace/recovery.ts</Path>","<Path>src/modules/browser/services/workspace.ts</Path>","<Path>src/modules/browser/services/ownership.ts</Path>","<Path>src/modules/browser/ui/RecoveryActions.tsx</Path>","<Path>src/modules/browser/platform/workspace-store.test.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
writable_paths: ["<Path>src/modules/browser/platform/workspace-store.ts</Path>","<Path>src/modules/browser/core/workspace/recovery.ts</Path>","<Path>src/modules/browser/services/workspace.ts</Path>","<Path>src/modules/browser/services/ownership.ts</Path>","<Path>src/modules/browser/ui/RecoveryActions.tsx</Path>","<Path>src/modules/browser/platform/workspace-store.test.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/platform/workspace-store.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-08（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-08（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/platform/workspace-store.ts</Path> => 2026-10-08-browser-ai-workbench::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/i18n.ts</Path> => 2026-10-08-browser-ai-workbench::T-08（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-08: 可靠重启、人工恢复与保存失败闭环

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-08.md](../evidence/T-08.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/08-workspace-restart-recovery.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 进程/guest退出、保存失败后可恢复事实和答案，无隐式重问；人工接管后可安全继续。

**规划时基线：** 首轮已要求intent先持久，此票补所有restart/partial write/文档手工编辑与capture recovery场景，不推迟基本发送安全。

**来源：** AC-011, AC-017, AC-020, AC-023, AC-025, AC-039；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

journal与Markdown按ID关联；重启submitting无法证明就unknown，readback原消息核对；不得以attempt TTL或文本hash推断未发。坏存储不覆盖；DocumentRepository保留未知frontmatter/用户块；已收答案保存失败进入既有recovery并仅retry-save。dispose释放owned资源；恢复readonly内容无需provider登录。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 进程/guest退出、保存失败后可恢复事实和答案，无隐式重问；人工接管后可安全继续。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

进程/guest退出、保存失败后可恢复事实和答案，无隐式重问；人工接管后可安全继续。

journal与Markdown按ID关联；重启submitting无法证明就unknown，readback原消息核对；不得以attempt TTL或文本hash推断未发。坏存储不覆盖；DocumentRepository保留未知frontmatter/用户块；已收答案保存失败进入既有recovery并仅retry-save。dispose释放owned资源；恢复readonly内容无需provider登录。

## 5. 实现契约

- **入口、输入输出、状态和错误：** journal与Markdown按ID关联；重启submitting无法证明就unknown，readback原消息核对；不得以attempt TTL或文本hash推断未发。坏存储不覆盖；DocumentRepository保留未知frontmatter/用户块；已收答案保存失败进入既有recovery并仅retry-save。dispose释放owned资源；恢复readonly内容无需provider登录。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-07；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 梳理T-03持久边界和DurableState flush/recovery、DocumentRepository.process契约，定义各崩溃点可恢复事实。
2. 实现启动恢复读取/缺损报告、pending attempt核对与page/profile重新验证；禁止自动重新submit。
3. 为save-failed接入现有recovery路径并提供保存重试/导出内容；保留用户Markdown未知字段与块外编辑。
4. 完善pause/takeover/resume和guest关闭/替换/模块disable收尾，取消后新的观察或mutation按用户动作恢复。
5. 测试一次intent后/submit后/保存失败三个代表断点及手工未知字段保留；真实Obsidian重启确认结果。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 故障数据 | 新增workspace-store.test.ts后 pnpm exec vitest run src/modules/browser/platform/workspace-store.test.ts | 坏文件不被空默认覆盖，unknown未重发，恢复capture可保存，用户块保留。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path> |
| 真实重启 | 已登录三站：提交接受后结束宿主并重开；已完整答案模拟vault不可写→恢复写权限→retry-save；人工改草稿后resume | 原站无自动第二条问题；已有答案可恢复；用户草稿不被覆盖；无残留控制。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 进程/guest与真实vault保存边界。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

每次schema升级保留原备份/未知字段，读失败停止写；当前schema=1不设计多版本泛用引擎。远端已发不可撤销，只记录事实；回滚代码先导出未落盘capture。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-011**：断开target是unknown，成功答案保留；不自动整组重发；recollect只读同消息，retry-save不发送；明确重发才新attempt
- [ ] **AC-017**：旧revision不覆盖新结果；latest partial不显示旧complete冒充；历史完成快照仍可明确查看；save-failed内容可恢复
- [ ] **AC-020**：稳定ID不变、结果按轮；删本地不删官网，owned边界明确；profile无权限/失效则只读本地并提示重绑
- [ ] **AC-023**：已证实结果恢复，未确认保留unknown，不自动submit；capture恢复后retry-save可成功；listener/queue/bridge释放
- [ ] **AC-025**：停止新mutation；已dispatch事实明确完成/unknown；resume重验identity/draft/ref，不使用过期引用；人工操作不被旧执行抢回
- [ ] **AC-039**：无残留guest hook/listener/queue/bridge/LLM会话owned任务；诊断去敏感；不破坏其他模块与普通浏览器
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
