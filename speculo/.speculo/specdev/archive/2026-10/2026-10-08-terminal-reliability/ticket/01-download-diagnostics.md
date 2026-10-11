---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path>","T-01 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:terminal-reliability:download-diagnostics","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-terminal-reliability"
id: "T-01"
title: "修复 helper 下载失败的HTTP与网络反馈"
status: "done"
kind: "bug"
planning_depth: "standard"
planning_depth_reason: "涉及明确的垂直行为及现有可复用接缝；验证按实际风险。"
ready: false
risk: "medium"
blocked_by: []
contract_ids: ["AC-001","AC-002","AC-003"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/agent/platform/desktop/pty/binary.ts</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.test.ts</Path>","<Path>src/modules/agent/services/controller.ts</Path>"]
writable_paths: ["<Path>src/modules/agent/platform/desktop/pty/binary.ts</Path>","<Path>src/modules/agent/platform/desktop/pty/binary.test.ts</Path>","<Path>src/modules/agent/services/controller.ts</Path>","<Path>src/modules/agent/i18n.ts</Path>","<Path>test/release/release-artifacts.test.ts</Path>","<Path>docs/agent-workbench.md</Path>","<Path>docs/agent-workbench.ZH.md</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-terminal-reliability::T-01（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-terminal-reliability::T-01（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-01: 修复 helper 下载失败的HTTP与网络反馈

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-01.md](../evidence/T-01.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ticket/01-download-diagnostics.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 全新用户能安装，不能安装时获得准确失败原因。

**规划时基线：** Release已存在，但controller以agent.helper.http吞掉状态与URL。

**来源：** AC-001, AC-002, AC-003；issue #135, #143；<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>。深度 standard：涉及明确的垂直行为及现有可复用接缝；验证按实际风险。

## 2. 决策状态

### 已锁定决策

保留安装校验/缓存/原子替换；HTTP error携带status、原始asset URL和版本，UI区分404/其他HTTP/网络/timeout。重定向签名不进入日志，已有文件不因错误被删除。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 全新用户能安装，不能安装时获得准确失败原因。 | 现有ensureHelper校验/原子替换、stdio协议3、五平台CI与exit清理 | 发布新版本/推送tag/下载旧helper兜底、GPL终端代码、把所有进程fd≥3都关闭 |

## 4. 要构建什么

全新用户能安装，不能安装时获得准确失败原因。

保留安装校验/缓存/原子替换；HTTP error携带status、原始asset URL和版本，UI区分404/其他HTTP/网络/timeout。重定向签名不进入日志，已有文件不因错误被删除。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 保留安装校验/缓存/原子替换；HTTP error携带status、原始asset URL和版本，UI区分404/其他HTTP/网络/timeout。重定向签名不进入日志，已有文件不因错误被删除。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** 无内部前置；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 用现有download seam固定404/503/timeout/校验错反馈，不新建网络模拟框架。
2. 贯通BinaryError→controller→双语反馈并限定诊断字段。
3. 核对实际Release五平台资产与stamp语义，在fresh库不注入本地helper运行安装。
4. 记录真实下载与握手结果、定向测试并更新故障说明。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 正常 | pnpm exec vitest run src/modules/agent/platform/desktop/pty/binary.test.ts test/release/release-artifacts.test.ts | 安装/资产契约通过 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path> |
| 失败 | download seam给404/503与网络异常，再做fresh宿主提示观察 | 不同原因可见、URL脱敏且旧文件保留 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path> |
| 回归 | 读取执行期manifest版本（规划基线0.0.1-alpha.1），从对应真实GitHub Release下载五平台nand-pty和sha256到独立临时资产目录；node scripts/verify-release-artifacts.mjs <manifest.version> <downloaded-terminal-dir>；fresh宿主真实Shell启动与重启 | 版本与五平台实际资产/摘要一致；fresh安装不设置NAND_PTY_BINARY，不以本地asset检查替代真实安装 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: Lead 在 current-workspace 的一次性测试库验证本票列明的真实宿主路径；不得用构建或stub替代。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

不发布Release。无数据迁移；回退错误类型调用链须同步，保留原二进制。若未来tag资产不齐，停止发布Gate而非改变下载到未知版本。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-001**：从当前Release下载匹配资产、digest校验、协议握手和会话打开
- [ ] **AC-002**：404说明该版本资产未发布，HTTP带状态，网络另文案；日志原始URL可诊断且无凭据
- [ ] **AC-003**：旧文件不被覆盖，错误可恢复，五平台命名和sha256清单准确
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
