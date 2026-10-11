---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-21 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-21 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:browser-delivery-evidence","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-21"
title: "完成八站产品支持证据、双语指南与许可归属"
status: "done"
kind: "documentation"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: false
risk: "medium"
blocked_by: ["T-01","T-09","T-10","T-11","T-12","T-13","T-14","T-17","T-19","T-20"]
contract_ids: ["AC-002","AC-015","AC-027","AC-028","AC-029","AC-030","AC-031","AC-039","AC-040"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path>","<Path>docs/browser.md</Path>","<Path>docs/browser.ZH.md</Path>","<Path>NOTICE</Path>","<Path>THIRD-PARTY-NOTICES.md</Path>","<Path>main.js</Path>","<Path>styles.css</Path>"]
writable_paths: ["<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path>","<Path>docs/browser.md</Path>","<Path>docs/browser.ZH.md</Path>","<Path>NOTICE</Path>","<Path>THIRD-PARTY-NOTICES.md</Path>","<Path>docs/third-party/orca-terminal-workbench.md</Path>","<Path>docs/third-party/orca-terminal-workbench.ZH.md</Path>","<Path>docs/third-party/multi-ai-workbench.md</Path>","<Path>docs/third-party/multi-ai-workbench.ZH.md</Path>","<Path>docs/third-party/multi-ai-LICENSE.txt</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-21（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-21（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-21: 完成八站产品支持证据、双语指南与许可归属

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-21.md](../evidence/T-21.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/21-browser-delivery-evidence.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 在已逐票功能完成基础上收束公开支持表、真实宿主使用指南、来源许可与产物一致性；不以这票替代前面真实验收。

**规划时基线：** 研究已经读取主参考与全部指定候选，尚无NAND实现或账号实测；后续前20票每票都必须具备自身验证，本票只交付最终用户可用说明及组合验收。

**来源：** AC-002, AC-015, AC-027, AC-028, AC-029, AC-030, AC-031, AC-039, AC-040；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

每个provider与OS/host版本标passed/limited/unverified及具体场景；三站Gate证据与八站扩展证据分开。文档说明profile、task≠官网历史、unknown/recollect/resend/save retry、迁移边界、opt-in数据去向/撤回。复制改编按固定SHA/路径/MIT或Apache许可更新NOTICE/attribution；AGPL只公共行为不引代码。 THIRD-PARTY-NOTICES.md 是依赖生成法律归属，不手工加.ZH副本；适配文件映射写 docs/third-party/ 的EN/ZH说明及原始LICENSE文本。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 在已逐票功能完成基础上收束公开支持表、真实宿主使用指南、来源许可与产物一致性；不以这票替代前面真实验收。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

在已逐票功能完成基础上收束公开支持表、真实宿主使用指南、来源许可与产物一致性；不以这票替代前面真实验收。

每个provider与OS/host版本标passed/limited/unverified及具体场景；三站Gate证据与八站扩展证据分开。文档说明profile、task≠官网历史、unknown/recollect/resend/save retry、迁移边界、opt-in数据去向/撤回。复制改编按固定SHA/路径/MIT或Apache许可更新NOTICE/attribution；AGPL只公共行为不引代码。 THIRD-PARTY-NOTICES.md 是依赖生成法律归属，不手工加.ZH副本；适配文件映射写 docs/third-party/ 的EN/ZH说明及原始LICENSE文本。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 每个provider与OS/host版本标passed/limited/unverified及具体场景；三站Gate证据与八站扩展证据分开。文档说明profile、task≠官网历史、unknown/recollect/resend/save retry、迁移边界、opt-in数据去向/撤回。复制改编按固定SHA/路径/MIT或Apache许可更新NOTICE/attribution；AGPL只公共行为不引代码。 THIRD-PARTY-NOTICES.md 是依赖生成法律归属，不手工加.ZH副本；适配文件映射写 docs/third-party/ 的EN/ZH说明及原始LICENSE文本。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-01, T-09, T-10, T-11, T-12, T-13, T-14, T-17, T-19, T-20；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 对照40条AC逐项指向所属票真实证据，修正遗漏功能而非只补测试；公开支持表不根据源码存在勾选。
2. 做最小跨能力组合host流程：两个profile、多站→重启→比较/导出→综合→助手接管→workflow→本地外接撤回；#142再走一次切换Scope。
3. 完成EN/ZH用户指南与故障动作说明，将实际复用源码的许可证/固定路径写NOTICE/第三方归属，未复用的不虚构归属。
4. 运行最终build/lint/architecture/bundle/i18n/docs与修改CSS检查，按相关失败修复；不重复无关全量兜底测试。
5. 同步main.js/styles.css，记录未跑OS/账号限制和后续维护入口；八站票未完成时整change不得宣称完成。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> |
| UI/规范 | node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | styles.css重建，界面可读可键盘操作、可见focus、无新增设计系统；移动端控制边界明确。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> |
| 文档/许可 | pnpm test:i18n；pnpm test:docs；如有源码改编 pnpm run notices 和 pnpm run check:notices | 双语键/文档/归属与实际源码一致，许可证不被遗漏。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> |
| 真实组合 | 在受控Obsidian vault执行上述组合场景并保存去敏感证据；按平台分开列Ctrl/Cmd shortcut与profile登录验证 | 40条AC有证据或明确阻塞，未验证不包装为支持；功能和产物一致。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 最终组合宿主验证；不要求无关站点/OS伪造通过。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

只新增明确version的数据与可选入口，保持旧普通浏览器/default profile兼容；回滚代码前停新任务、导出用户Markdown，保留未知字段和journal，不回滚官网已提交事实。错误以明确reason/状态呈现，不自动重发。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-002**：guest既有行为保持；只当前page响应；Esc顺序保持；hidden/旧window不抢键，无handler累积；IME不打断
- [ ] **AC-015**：每站和全组各有分母/发送确认/采集/完整性/关联/重复/人工/恢复/耗时；账号/OS缺失标未验证；无已知错发/自动重发/假complete才开后续Gate
- [ ] **AC-027**：实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据
- [ ] **AC-028**：实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据
- [ ] **AC-029**：实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据
- [ ] **AC-030**：实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据
- [ ] **AC-031**：实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据
- [ ] **AC-039**：无残留guest hook/listener/queue/bridge/LLM会话owned任务；诊断去敏感；不破坏其他模块与普通浏览器
- [ ] **AC-040**：lazy/boundary/bundle/i18n/CSS/docs通过；仅实测项写支持；参考来源/NOTICE准确，main.js/styles.css随源重建；无本轮规划冒充实现
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
