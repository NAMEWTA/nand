---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:browser-host-shortcuts","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-01"
title: "修复地址栏与工具栏 Mod+F / Mod+L"
status: "ready"
kind: "bug"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: true
risk: "medium"
blocked_by: []
contract_ids: ["AC-001","AC-002"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/ui/BrowserPanel.tsx</Path>","<Path>src/modules/browser/ui/browser-key-scope.ts</Path>","<Path>src/modules/browser/ui/browser-presentation.tsx</Path>","<Path>src/modules/browser/ui/browser-modal.tsx</Path>","<Path>src/modules/browser/browser.test.ts</Path>","<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path>"]
writable_paths: ["<Path>src/modules/browser/ui/BrowserPanel.tsx</Path>","<Path>src/modules/browser/ui/browser-key-scope.ts</Path>","<Path>src/modules/browser/ui/browser-presentation.tsx</Path>","<Path>src/modules/browser/ui/browser-modal.tsx</Path>","<Path>src/modules/browser/browser.test.ts</Path>","<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/ui/BrowserPanel.tsx</Path>","<Path>src/modules/browser/browser.test.ts</Path>","<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/ui/BrowserPanel.tsx</Path> => 2026-10-08-browser-ai-workbench::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/browser.test.ts</Path> => 2026-10-08-browser-ai-workbench::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>scripts/obsidian-acceptance/workbench-probe.mjs</Path> => 2026-10-08-browser-ai-workbench::T-01（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-01: 修复地址栏与工具栏 Mod+F / Mod+L

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-01.md](../evidence/T-01.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/01-browser-host-shortcuts.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** #142独立第一票；真实宿主地址栏按F立即输入查找、L选中地址，guest/笔记无回归。

**规划时基线：** BrowserPanel容器冒泡监听可能早于到达时已被Obsidian消费；guest-policy before-input-event正常；现有comments composer有局部Scope模式可阅读但不能跨模块import。

**来源：** AC-001, AC-002；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

以Scope Mod bindings调用统一openFind/focusAddress；admission限定可见当前浏览器焦点，release涵盖blur/hidden/unmount/popout迁移；Esc既有优先级、IME/额外组合键保留。若现有NativeSurface不足，先在此票记录最小host scope port必要性再修改，不默认扩大shell。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| #142独立第一票；真实宿主地址栏按F立即输入查找、L选中地址，guest/笔记无回归。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

#142独立第一票；真实宿主地址栏按F立即输入查找、L选中地址，guest/笔记无回归。

以Scope Mod bindings调用统一openFind/focusAddress；admission限定可见当前浏览器焦点，release涵盖blur/hidden/unmount/popout迁移；Esc既有优先级、IME/额外组合键保留。若现有NativeSurface不足，先在此票记录最小host scope port必要性再修改，不默认扩大shell。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 以Scope Mod bindings调用统一openFind/focusAddress；admission限定可见当前浏览器焦点，release涵盖blur/hidden/unmount/popout迁移；Esc既有优先级、IME/额外组合键保留。若现有NativeSurface不足，先在此票记录最小host scope port必要性再修改，不默认扩大shell。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 读BrowserPanel/guest-policy与comments Scope范例，真实宿主复现issue三次并记录host/OS。
2. 抽出同一动作，接入浏览器局部Scope；复用el.win/doc及lifetime，不增加全局默认hotkey。
3. 在presentation/modal可见和窗口迁移生命周期释放Scope；检查两页不重复响应。
4. 扩既有workbench-probe用native CDP Input.dispatchKeyEvent输入F/L和文字，不用DOM dispatch伪验证；仅添一条有价值生命周期回归。
5. 运行build/lint/browser测试和真实host；更新docs仅当用户行为说明变化，保持双语。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 单元回归 | pnpm exec vitest run src/modules/browser/browser.test.ts | 现有guest快捷键/queue/lifecycle全通过，增加的局部Scope行为断言通过。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path> |
| 原始bug/回归 | 真实Obsidian1.13.x：地址栏Ctrl+F输入domain三次；Ctrl+L；guest重复；modal/split/popout；切笔记、关闭、disable；Windows Ctrl/macOS Cmd列独立运行状态 | 地址不变、find获得文字；scope不泄漏。未运行OS注明未验证。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: native hotkey事件必须真实Obsidian证明，DOM单测不足。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

无schema迁移；回滚仅局部Scope代码。闭合/隐藏必须注销，不碰用户Hotkeys配置。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-001**：F打开并聚焦find；文字不进地址；L选中完整地址；无宿主checklist动作，每按一次只响应一次
- [ ] **AC-002**：guest既有行为保持；只当前page响应；Esc顺序保持；hidden/旧window不抢键，无handler累积；IME不打断
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
