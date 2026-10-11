# 本地新闻工作台与 Agent 分析 — Change ADR

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 10 票、28 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

## ADR-001: 平台与默认开关

**Status:** accepted
**Source:** LOG-001；本轮用户明确确认；dev module-authoring 远程/进程模块 defaultEnabled=false
**Supersedes:** none（本change合同，不改写永久知识）

### Context

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### Decision

news 默认关闭；桌面提供完整采集和 Agent 分析；手机通过 Obsidian 阅读同步的收藏、日报和简报 Markdown，不承诺设备缓存自动跨设备共享或手机CLI。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-002: 刷新授权与周期

**Status:** accepted
**Source:** LOG-002；本轮用户明确确认；#136第五节；ui shell规则
**Supersedes:** none（本change合同，不改写永久知识）

### Context

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### Decision

保留手动刷新；过期打开刷新与启动刷新均为 opt-in；运行期间周期采集默认关闭，若用户启用只能由 news 自有调度，不建自动化定义或cron。UI render/navigate保持纯读，已启用策略由服务处理可见事件并去重。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-003: 完整后段功能

**Status:** accepted
**Source:** LOG-005；本轮用户明确确认；#136 P5
**Supersedes:** none（本change合同，不改写永久知识）

### Context

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### Decision

OPML、静态网页列表、双评分、7天曲线均在本change完整范围；不是以首版为由移除。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-004: Agent与home共享接口owner

**Status:** accepted
**Source:** LOG-006；本轮父代理跨change协调；#136第五节
**Supersedes:** none（本change合同，不改写永久知识）

### Context

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### Decision

依赖home change提供的公共Agent目录/派发入口；新闻仅新增AGENT_PROMPT_RUNNER结构化一次性执行接口，内部复用agent现有runtime，不伪造AutomationRun，不重复定义公共目录。首页小组件依赖home统一注册表，不同时造临时注册路径。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-005: 事件/发生两层身份

**Status:** accepted
**Source:** LOG-007；AIHOT group.ts、recall.ts、edition.ts源码事实；#136要求对应推导
**Supersedes:** none（本change合同，不改写永久知识）

### Context

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### Decision

Event内保留occurrences而不是只Material→Event。SAME_OCCURRENCE合发生，SAME_STORY关联根发生形成进展，ROUNDUP只引用不桥接；代表稿和日报按发生身份计算。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-006: 本地数据与许可

**Status:** accepted
**Source:** LOG-008；#136第二、六、十节；dev licensing/data规则
**Supersedes:** none（本change合同，不改写永久知识）

### Context

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

### Decision

配置namespace和设备JsonStore，用户收藏/日报/简报为可见Markdown；自主重写算法/提示词时保留MIT版权和SHA映射；不使用AIHOT名称Logo、Postgres/服务端/模型API。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。
