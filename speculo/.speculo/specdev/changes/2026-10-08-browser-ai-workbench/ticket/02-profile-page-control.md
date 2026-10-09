---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-02 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"dfec45b11d78296560406f2808cf3824b271ea803b59d8d1ff87e105d12327b1","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-02 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:profile-page-control","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-02"
title: "默认兼容的多账号 profile 与显式页面控制"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: []
contract_ids: ["AC-003","AC-004","AC-024","AC-026","AC-039"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/core/model.ts</Path>","<Path>src/modules/browser/platform/store.ts</Path>","<Path>src/modules/browser/platform/profile-store.ts</Path>","<Path>src/modules/browser/platform/desktop/page.ts</Path>","<Path>src/modules/browser/platform/desktop/guest-policy.ts</Path>","<Path>src/modules/browser/services/index.ts</Path>","<Path>src/modules/browser/services/profile-service.ts</Path>","<Path>src/modules/browser/ui/settings-page.ts</Path>","<Path>src/modules/browser/settings.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/browser.test.ts</Path>"]
writable_paths: ["<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/core/model.ts</Path>","<Path>src/modules/browser/platform/store.ts</Path>","<Path>src/modules/browser/platform/profile-store.ts</Path>","<Path>src/modules/browser/platform/desktop/page.ts</Path>","<Path>src/modules/browser/platform/desktop/guest-policy.ts</Path>","<Path>src/modules/browser/services/index.ts</Path>","<Path>src/modules/browser/services/profile-service.ts</Path>","<Path>src/modules/browser/ui/settings-page.ts</Path>","<Path>src/modules/browser/settings.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/browser.test.ts</Path>","<Path>src/shared/i18n/lazy/browser.ts</Path>","<Path>src/shared/i18n/browser.ts</Path>","<Path>docs/browser.md</Path>","<Path>docs/browser.ZH.md</Path>","<Path>src/modules/browser/manifest.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/browser.test.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-02（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-02（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/browser.test.ts</Path> => 2026-10-08-browser-ai-workbench::T-02（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-02: 默认兼容的多账号 profile 与显式页面控制

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/02-profile-page-control.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户可保持旧登录并新增同站隔离账号；后续工作台可显式读/控某page而不抢前台或控制错页。

**当前事实：** createPage硬编码同vault partition；execute对snapshot等读操作也activate；已有page稳定ID/queue/ref和token bridge可复用。现有决策为 speculo/.speculo/specdev/adr/0010-browser-sessions.md 及 .ZH.md，永久ADR只读；可选profile扩展记录在当前change ADR，实施后由A验收并提升。

**来源：** AC-003, AC-004, AC-024, AC-026, AC-039；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

新增Profile metadata/schema、default分区完全保留；page创建时冻结profile+generation。BROWSER_CONTROL仅显式typed目标，不暴露任意webContents/CDP；读操作不activate，native input若需focus明确有界调度。所有mutation沿原queue；close/replacement拒绝陈旧target。删除隔离profile列影响并明确确认。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户可保持旧登录并新增同站隔离账号；后续工作台可显式读/控某page而不抢前台或控制错页。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

用户可保持旧登录并新增同站隔离账号；后续工作台可显式读/控某page而不抢前台或控制错页。

新增Profile metadata/schema、default分区完全保留；page创建时冻结profile+generation。BROWSER_CONTROL仅显式typed目标，不暴露任意webContents/CDP；读操作不activate，native input若需focus明确有界调度。所有mutation沿原queue；close/replacement拒绝陈旧target。删除隔离profile列影响并明确确认。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 新增Profile metadata/schema、default分区完全保留；page创建时冻结profile+generation。BROWSER_CONTROL仅显式typed目标，不暴露任意webContents/CDP；读操作不activate，native input若需focus明确有界调度。所有mutation沿原queue；close/replacement拒绝陈旧target。删除隔离profile列影响并明确确认。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 读api/services/page/store/ADR-0010与ORCA固定session-registry/queue/target-routing，列现有职责而不引入新daemon。
2. 实现profile store及default兼容迁移，desktop创建按显式profile选择partition；扩typed api与page身份。
3. 分离只读observe与需用户焦点动作，复用queue与generation核验；保存权限/popup同partition行为。
4. 做原生settings/目标账号选择，删除profile关闭相关guest并撤回执行权；browser新增own i18n注册，保留启动实际用键。
5. 补一条default兼容/隔离持久与一条background-read目标不变测试；真实双账号/重启/close观察；记录ADR可选隔离扩展。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 身份/兼容 | pnpm exec vitest run src/modules/browser/browser.test.ts；新增profile-store.test.ts后 pnpm exec vitest run src/modules/browser/platform/profile-store.test.ts | default partition字节不变，隔离target不能串用，读不activate、旧generation明确失败。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path> |
| 真实登录 | 受控Obsidian vault：default登录一个账号，isolated登录同站另一账号，重启并分别打开/关闭/删除isolated | 用户label可辨、cookies隔离、default旧登录保留；只清所选隔离数据。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: partition/SSO/guest focus是宿主行为。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

profiles schemaVersion=1增量，旧state.json路径不变；默认登录不迁移。删除隔离profile是用户明确操作且清本地登录不可恢复，确认列影响；其他数据可通过Markdown导出。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-003**：旧default partition不变；两账号target标识可辨且登录隔离保持；未验证账号身份不自动猜
- [ ] **AC-004**：切换创建新guest并重新绑定；删除先展示受影响对象再关闭guest撤权清本地登录；default标识不可删除；官网历史不删
- [ ] **AC-024**：read不抢焦点；执行仍绑定显式page/profile/generation；旧ref明确失败；关闭后queued settle且无迟到mutation
- [ ] **AC-026**：仅该provider allowlist/该task采必要字段；token/cookie/password被剔除，默认无全网HAR；卸载或取消移除hook
- [ ] **AC-039**：无残留guest hook/listener/queue/bridge/LLM会话owned任务；诊断去敏感；不破坏其他模块与普通浏览器
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
