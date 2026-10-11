# NAND 私有目录和文件的最小POSIX权限 — 设计与规划记录

## LOG-001 — 2026-10-09T04:27:47.546747+00:00 — 限定平台与根

- 设计树节点：D-001；round 1；依赖：无。
- 状态：confirmed。
- 问题：限定平台与根。
- 事实与来源：#144。
- 推荐与结论：仅桌面FileSystemAdapter且POSIX；目录0700文件0600；Windows/mobile/nonfilesystem保持原行为。
- 原因：保持源需求与当前规范一致；已由原始明确需求、当前契约或本轮用户回答支持，不将模型推断写成用户原话。
- 影响：Spec与本change Tickets；本轮只规划。
- 替代：如与旧issue基线冲突，以当前代码事实修正现状描述，保留原始来源。

## LOG-002 — 2026-10-09T04:27:47.546747+00:00 — 升级兼容

- 设计树节点：D-002；round 1；依赖：无。
- 状态：confirmed。
- 问题：升级兼容。
- 事实与来源：#144+存储架构。
- 推荐与结论：加载时收紧.nand根及管理子路径；不跟随symlink、不修改根外对象，失败日志非致命。
- 原因：保持源需求与当前规范一致；已由原始明确需求、当前契约或本轮用户回答支持，不将模型推断写成用户原话。
- 影响：Spec与本change Tickets；本轮只规划。
- 替代：如与旧issue基线冲突，以当前代码事实修正现状描述，保留原始来源。

## 事实与确认范围

源基线 1b9121382363cc50254fbc973c24742b7742edc7，本次只是规划。用户明确：完整规划；所有BUG有修复票和验收；后续current严格串行；仅SpecDev运行时工件单一中文。实际参考研究见 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>。最终共识状态以设计树为准；未确认前不发布Ready。

## LOG-003 — 全部设计分支最终共识

- 节点：D-003；round 2；前置：D-001, D-002。
- 用户明确回答：“确认，完成全部规划（推荐）”。
- 结论：设计树consensus；已确认产品设计并成熟为Spec/Tickets。仍只规划，执行门不打开。

## 规划质量审查记录

Owner：T/P，使用common/skills/plan-quality-review；输入为完整issue、当前源码、Spec/所有Ticket/Map、用户授权和实际dev/ui技能摘要。检查背景/边界、真实调用、公共接口、路径/语义资源、验收数量、授权和恢复，结论pass（规划）。没有创建产品执行Evidence。

已修正的实际发现：权限writer覆盖及每级symlink；Git库外unstage-all与实际push target；档案准确字节规模工具；终端五平台资产验证；HOME_WIDGETS每模块provider bundle；dispatch交付与prompt结果严格分离；自动化typed workflow装配、编辑器和receipt；browser内部scope与短期runContext env仅最终spawn合并、不进入accountKey；浏览器manifest和真正UI入口；永久ADR保持只读；站点/历史等虚假串行依赖已移除。

所有61票有完整3–7步路线、边界/恢复/具体验证，180 AC全部覆盖。局部验证工具对Ready独立票的171对已登记共享路径给出提示；父图以222对实际路径serialization、全局current唯一writer和票阶段专用owner交接消解，不伪造功能边。产品验收仍依各票的真实环境完成。

## 规划发布前 Skill rebind

工作区用户并行更新dev/ui及references为中文单份；已重读入口、AGENTS和规则差异，功能/结构硬边界未减弱。移除计划对不存在的Skill .ZH.md写入要求，保留用户文档双语。全部Ticket摘要重绑，Map plan_revision=2；无产品范围或执行授权变化。

## 2026-10-11 完成补录与归档

用户确认 Windows 验收范围；CI 修复及远程验证通过。正式 Ticket/Map/Goal 状态与共享 Git checkpoint 按实际证据补录，见 [completion.md](evidence/completion.md)。历史原文未删除，技能摘要重新读取当前文件并更新；无需分支或 worktree 清理。
