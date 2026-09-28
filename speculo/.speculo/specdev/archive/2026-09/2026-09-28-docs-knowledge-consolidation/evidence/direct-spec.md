# 知识整理直接验收证据

## 授权、范围与基线
用户在审阅方案后明确要求 Implement the plan，已确认四份指南保留、原始材料完整归档。基线提交 fa1803c4c435d6541992d6e85c1e02f61b27c51b，开始时工作区干净。本次由 codex-docs-consolidation 单一 owner 执行，无子代理、实现票、Git 提交或远程动作。

本次为非产品实现型知识整理，使用 KC 等价验收，不伪造产品实现 Ticket 或提交。归档前本文件记录知识候选及公开改稿的检查；A 网关随后的原子移动、知识写入、38 项删除和最终状态重读，记录在 <Path>{roots.state}/commands/archive-and-consolidate/2026-09-28-specdev-docs-knowledge-consolidation.md</Path> 的执行补遗。归档封存后本证据不再追加。

## 合同与交付
| 合同 | 归档前事实 | 归档流程中的最终检查 |
|---|---|---|
| KC-001 | 44 份原件已复制并逐字节核验，清单记录各自摘要 | 清理前再次检查 44 份副本及待删来源 |
| KC-002 | 九项 ADR 逐项核对当前代码；八份词汇表及 Context Map 形成；完整出处记录 | 永久目录按候选精确提升并比较内容 |
| KC-003 | 四份指南已去除开发过程，两个公开资产未改；38 项删除路径已固定 | 公开目录精确剩余六项 |
| KC-004 | README、CHANGELOG、技能及四份 handoff 导航已更新 | 新引用、现役引用和归档位置均可解析 |
| KC-005 | 构建成功；lint 0 errors、157 warnings；架构检查 580 模块通过 | main.js 摘要及许可证仍与基线相同 |
| KC-006 | 本次 change 在 active 唯一登记，无其他活动 change | archive 后索引唯一、源消失、终态一致，其他归档不变 |

来源及处理详情：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-manifest.json</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-map.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/context-provenance.md</Path>。

## 实际命令
- pnpm run build：exit 0；日志 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/build.log</Path>。
- pnpm run lint：exit 0；0 errors、157 warnings，日志 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/lint.log</Path>。
- pnpm test:architecture：exit 0；580 个生产模块，依赖方向、宿主边界及运行时循环检查通过。
- validate-specdev --self-check：exit 0；0 errors、0 warnings。
- skill-creator quick_validate 首次因环境缺少 PyYAML 未运行；使用 uv 隔离依赖后发现原有 when-to-use 扩展键不受其格式支持，将其原文移入正文，保持技能范围和触发描述不变。修复后结果另记下方收尾检查。
- 初次 Spec 检查发现通用校验器将 AC 强制绑定实现 Ticket；按 A 非实现型完成合同保留全部验收内容并使用 KC 编号，具体判断见 LOG-004。没有改动校验器或跳过知识与原件检查。

## 验证边界
没有改变产品源码、协议或行为，因此本次不重跑 49 个产品测试入口，不进行新的 GUI／移动端验收。快照中的历史测试、图片和构建指纹保持原义；本次 build/lint/架构检查不能替代真实拖拽、窗口、媒体或已认证 CLI 的验证。

## 恢复
原件完整保存，删除名单来自清单且删前核验，不使用目录递归清空。如需恢复公开历史材料，按 source 与 snapshot 对应关系逐文件复制；已经修改的四份用户指南有各自原件可供比较。既有归档与其他跟踪文件通过工作区基线摘要保护。

## 归档前收尾检查
- 文档迁移审计通过：44 份快照一致；67 条术语按八个领域组织，另有一个 Context Map；新引用与改动消费者引用均可解析。原始历史链接明确不作为现役导航。
- 九项 ADR 均有独立主题、真实取舍说明、当前代码证据和来源；源码文件存在且未改变。通过毕业条件：稳定机制、接手者必知；局部修复未单独提升。
- quick_validate：Skill is valid；技能 frontmatter 和作用范围有效。
- SpecDev 当前 change 默认校验：0 errors、0 warnings；完成状态设置后另行运行 complete。
- 工作区基线审计：1202 个不属于本任务写集的原跟踪文件摘要一致，包括既有归档、全部产品源码、构建配置和 main.js。许可证原文及产物归属完整。
- 原始目录 38 项清理仍属于随后的 A 归档流程；本文件不提前宣称源已删除或永久目录已写入。最终执行补遗是这些动作的验证权威。

- complete 阶段已在 completed 状态下实际通过：0 errors、0 warnings，日志见<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/specdev-complete.log</Path>。包级自检和 diff 空白检查通过；最终 preflight 引用数为 315，结果见 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/preflight-verification.json</Path>。
