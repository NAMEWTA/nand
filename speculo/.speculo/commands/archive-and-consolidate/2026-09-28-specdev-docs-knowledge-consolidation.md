# 文档知识沉淀执行计划

## 授权与路径
用户已确认保留四份纯用户指南、完整归档历史材料，并对展示的完整计划明确回复“Implement the plan”。本报告落实该批准范围，无需重复请求同一授权。模式：consolidate-from-code → archive-single；知识策略：generic。

项目根为 <Path>./</Path>，由 <Path>{roots.state}/workspace.json</Path> 的 project-root 相对 roots 解析。嵌套安装的实际 workflow/state 根为 <Path>{roots.workflows}/specdev/</Path> 与 <Path>{roots.state}/specdev/</Path>，报告位于 <Path>{roots.state}/commands/archive-and-consolidate/</Path>。不采用通用技能中不适用于嵌套安装的顶层字面拼接。

## 计划与批准动作
- 创建非产品实现型知识 change <Path>{roots.state}/specdev/changes/2026-09-28-docs-knowledge-consolidation/</Path>，验证完成后原子移动到 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/</Path>。
- 九项 ADR 按候选源提升至 <Path>{roots.state}/specdev/adr/</Path>；八份领域词汇和 Context Map 提升至 <Path>{roots.state}/specdev/context/</Path>。原目录为空，无已有术语或 ADR 冲突；删除两处已有内容后的空占位文件。
- 全部 44 份原件快照后核对摘要；八份内部 Markdown、27 张内部图片及三份 JSON 共 38 项从公开目录删除。
- 四份用户指南改稿，公开工作台配图和许可证保留。README、CHANGELOG、开发技能及四份 handoff 修正导航；领域布局约定记录受众边界。
- 不修改既有归档、Speculo 安装元数据、源码、插件数据或远程状态；不创建提交。

## 保真与风险
逐文件目标、动作、毕业理由见 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-manifest.json</Path> 和 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-map.md</Path>。删除属已批准动作，风险由完整快照、重复摘要核验与来源漂移检查控制。历史原件链接不改写，由来源映射提供现役入口。

## 完成与校验顺序
候选及公开改稿验证 → 完成非实现型 change → complete 阶段校验 → 原子归档并更新状态 → 写入已通过毕业评估的永久知识 → 核对 44 份副本 → 清理 38 项 → 重读所有现役路径及状态。

归档后校验器会提示 archived 状态的正常警告；complete 只在归档前运行，不为消除警告伪造 completed 状态。执行后结果在本报告补遗，归档一旦封存不再改写其证据。

## 执行后验证补遗

完成时间：2026-09-28T05:47:23.264742+00:00。本次计划内动作全部完成。

- 非产品实现型知识 change 已完成并原子归档；全局 active 不再包含该 change，archived 唯一登记，归档状态与路径一致。
- 九项 ADR 全部通过毕业评估并逐份提升；八份领域词汇表共 67 条术语及独立 Context Map 已写入。候选到永久正文一致，词汇文件不承载测试历史或代码导航。目录已有正文后移除了两份空占位文件。
- 全部 44 份原始文件已逐项核对 SHA-256 与字节数；38 份内部材料已从公开 docs 删除。四份用户指南、工作台配图和 Orca 许可证保留。已重读公开目录，结果精确为六个文件。
- 新工件及现役消费者共核对 388 个本地引用。报告中的源 change 路径是已迁出位置，按迁移来源保留；原始历史快照中的旧引用按来源映射解释。
- 1202 个不属于写集的原跟踪文件摘要一致，包含既有归档、源码、依赖和构建配置。main.js SHA-256 为 02d032a30bf39424ba70c982415e286d889c3a236d0dcf61e644c6ea780a954c，与基线相同。Orca 许可原文及构建 banner 保留。
- 构建、lint、架构检查和 SpecDev 包级自检通过；lint 为 0 errors、157 warnings。complete 在归档前通过，0 errors、0 warnings；归档后默认校验为 0 errors、1 warning，警告仅提示正在校验 archived change。diff 空白检查通过。
- 开发技能的 when-to-use 原有扩展键不被通用技能校验器接受，原文已移入正文；触发描述与范围保持不变。隔离安装 PyYAML 后 quick_validate 返回 Skill is valid。
- 非实现流程使用 KC 等价验收编号，避免虚构产品 Ticket 与提交。所有六项合同保持且逐项验证；没有修改工作流包或校验器。
- 历史原件、测试 JSON 和截图没有修改。归档封存后重算所有归档文件摘要一致。
- 没有提交、推送、发布或操作远程 Issue；没有新的产品 GUI／移动端验收。

### 最终文档审计结果

~~~json
{
  "phase": "final",
  "snapshot_files_verified": 44,
  "public_files": 6,
  "cleanup_files": 38,
  "adr_count": 9,
  "vocabulary_files": 8,
  "terms": 67,
  "context_maps": 1,
  "checked_local_references": 388,
  "intentional_migration_origin_references": 1,
  "unrelated_tracked_files_unchanged": 1202,
  "main_js_sha256": "02d032a30bf39424ba70c982415e286d889c3a236d0dcf61e644c6ea780a954c",
  "status": "passed"
}
~~~

### SpecDev 归档重读结果

~~~text
WARNING: validating an archived change in place; normally it lives under the archive root
Summary: 0 error(s), 1 warning(s)
~~~

验证资料入口：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/direct-spec.md</Path>；逐文件来源与去向：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-map.md</Path>。
