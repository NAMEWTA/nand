---
id: specdev/archive-and-consolidate
type: workflow-entry
workflow: specdev
name: 归档与沉淀
description: 校验本地完成、源 Issue reconcile 门和票级 publish_action 门，复用全局归档能力移动 completed change 并提升当前知识，或从代码访谈形成可归档知识 change。
keywords: [归档, consolidation, ADR, context, research, knowledge, 代码库访谈]
---

# 归档与沉淀

> 激活本 Work 后，先读取 `<Path>{roots.workflows}/specdev/README.md</Path>`，再执行本入口。

A 是 SpecDev 的归档 wrapper：它拥有模式选择、SpecDev 完成门和代码访谈；机械扫描、dry-run、知识毕业、合并、清理、移动与重读由 `<Path>{roots.skills}/archive-and-consolidate/SKILL.md</Path>` 单一维护。

激活时读取 `<Path>{roots.workflows}/specdev/common/rules/activation-and-memory.md</Path>`，按当前步骤定位输入和证据。

## 模式

- **archive**：处理用户指定或唯一的 completed change。
- **consolidate-from-code**：用户明确要求从当前代码沉淀知识，或没有可归档 change；本次访谈本身创建一个 change，形成、验证、完成后再归档。
- **refresh-facts**：用户授权纠正现有永久 context 中的机械事实或事实源指针；按 `<Path>{roots.workflows}/specdev/A-archive-and-consolidate/fact-refresh.md</Path>` 执行，不创建开发 Change。

明确的事实校正优先匹配 refresh-facts；缺少 completed change 本身不触发代码访谈。多个会实质改变交付的候选或模式冲突时才请求消歧。

## Archive 模式

1. 读取全局/change 状态、Ticket、Map、Goal Plan、Evidence、ADR、CONTEXT、LOG、triage 和项目验证事实。
2. 加载 `<Path>{roots.workflows}/specdev/common/rules/change-completion.md</Path>` 与 `<Path>{roots.workflows}/specdev/common/rules/parent-implementation-orchestration.md</Path>`，确认 `change_status: completed`、完成 owner 已写入时间和证据、无 blocker/deviation；若该 change 是未完成父实现 change 的成员则停止，若其自身是父实现 change 则还需所有成员与 aggregate Evidence 完成。
3. 检查 `<Path>{roots.state}/specdev/changes/{change}/triage.md</Path>` 的 `external_action`：`pending-close` 或 `close-failed` 返回 `<Path>{roots.workflows}/specdev/T-triage/T-triage.md</Path>`；只有 `closed | waived | not-applicable` 继续。再检查 `publish_action`：`pending` 或 `publish-failed` 同样返回 T-triage publish；只有 `not-requested | published | waived`（缺省视为 `not-requested`）继续。
4. 调用 `<Path>{roots.skills}/archive-and-consolidate/SKILL.md</Path>` 的 `archive-single + dry-run`，传入已解析 workflow/state/changes/archive/knowledge roots。展示完整移动、提升和清理计划。
5. 核对用户授权覆盖具体计划后调用 `confirmed`；已有授权不重复询问。移动、知识写入和清理均使用计划内路径；计划后出现 drift 时重验受影响项，范围或风险变化才补充授权。
6. 重读源、归档目标、全局索引、归档 `<Path>{roots.state}/specdev/archive/YYYY-MM/{change}/.status.json</Path>` 和永久知识；运行 `--stage complete` 及包级校验，报告每个提升/跳过结论。

## Consolidate-from-code 模式

读取 `<Path>{roots.workflows}/specdev/A-archive-and-consolidate/consolidation-interview.md</Path>`，由本 Work 创建知识 change、按代码证据访谈并验证后关闭，再回到 Archive 模式。LOG/CONTEXT/ADR 先在该 change 内形成；未验证结论留在 LOG，不直接提升永久知识。

## 副作用

Dry-run 不修改文件。归档移动、知识 merge/rewrite/delete、Git 动作分别核对其授权范围，可以由同一次明确请求授权；不以流程阶段切换要求重复确认。归档目录完成后只读；后续纠正通过新 change 和 supersedes 链完成。

## 完成标准

refresh-facts 使用其参考中的完成标准，不套用下列归档移动条件。

- 模式与唯一 change 已确定；
- 本地完成、external reconcile 门和 publish_action 门通过；
- 机械归档与知识规则只有全局 skill 一个事实源；
- dry-run 与 confirmed 执行严格分离；
- 源不存在、目标完整、active/archived 无重叠、归档状态正确；
- 永久知识只包含当前、跨 change 有用且有实现证据的结论；
- 无未批准移动、删除、改写或 Git 副作用。
