# 规划验证报告

本报告由P拥有，证明规划工件可解析、范围完整与基线检查结果。**不是61张产品票的执行Evidence**。产品实施0/61，GitHub关闭0/13；未做真实AI账号、Obsidian图形宿主或跨平台新功能验收。

## 范围与不可变来源

- 仓库 NAMEWTA/nand；源码基线 `1b9121382363cc50254fbc973c24742b7742edc7`，本轮结束HEAD未变化。
- 全部13个open issue：#124、#134–#145；完整正文、全部评论（均0）、两次稳定读取和完整分页。末次重新读取仍13个，updated_at无漂移。
- 13份不可变快照正文逐字与transport原文核对通过；来源索引见 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/source-index.json</Path>。源引用中的旧路径和旧版本作为历史事实保留。
- 8域、61票、180 AC：每个AC至少一张负责票，内部和跨域依赖均可解析、无环；每票3–7步、真实Skill摘要、路径、验证、恢复与验收齐全。

## 工件检查

| 检查 | 结果 | 证据与限制 |
|---|---|---|
| 8域 × triage/grill/spec/tickets/goal-plan，共40次 | 全部0错误 | 当前schema；局部提示171对独立票共享路径，均有阶段专用owner和父serialization，不新增虚假依赖 |
| 整体parent goal-plan | 0错误、0警告 | 61 task、87真实边、222路径serialization；current唯一writer |
| 8子Map + 1父Map 的ticket-control | 9个read-only分析均无结构错误 | authorization_checked=false；执行门未开，不能把可解析视为授权或完成 |
| Skill rebind | 全部61票按当前入口与references重新绑定 | 用户并行将dev/ui技能改为中文单份；保留该改动，移除计划中Skill .ZH路径；产品/用户文档仍双语；Map revision=2 |
| 原有工作区内容保护 | 初始145个dirty/untracked路径digest与mode保持 | 另有用户并行AGENTS/skills/docs-checker变更，均保留；本任务只写SpecDev运行时规划 |

完整命令、exit、计数和输出摘要见 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-checks.json</Path>，父原始输出见 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-parent-validation.log</Path>。

复核命令：

```bash
node speculo/workflows/specdev/common/tools/validate-specdev.mjs --stage goal-plan --repo /home/wta/projects/nand speculo/.speculo/specdev/changes/2026-10-08-all-open-issues
node speculo/workflows/specdev/common/tools/ticket-control.mjs --map speculo/.speculo/specdev/changes/2026-10-08-all-open-issues/tickets-map.md --repo /home/wta/projects/nand
```

对子change按同一validator分别运行triage/grill/spec/tickets/goal-plan；所有文件路径以workspace roots解析。

## 当前代码基线检查

- `pnpm run build`：通过，类型检查和105份作者样式检查通过，重建main.js无产品diff。
- `pnpm run lint`：通过，零警告。
- 下列定向基线：**6个测试文件、91项通过**。它们支持当前事实核验，不证明待实施功能已经通过。

```bash
pnpm exec vitest run src/modules/archives/archives.test.ts src/modules/sync/core/core.test.ts src/modules/sync/services/automatics.test.ts test/sync/git-flow.test.ts src/modules/agent/platform/desktop/pty/binary.test.ts test/release/release-artifacts.test.ts
```

原始日志：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-baseline-tests.log</Path>、<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-build.log</Path>、<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-lint.log</Path>。

## 文档校验的已知规则冲突

原始 `pnpm test:docs` **未通过**。原因限于本批运行时文件：检查器仍要求SpecDev每份文档有`.ZH.md`和语言切换；用户已明确批准本轮运行时单一中文。另将不可变issue标题中的连续方括号领域/类别标签识别成未定义Markdown引用链接。

没有修改仓库校验器来掩盖结果。基于当前校验器的临时副本，只对本次9个change和总览应用已确认语言例外，并允许源快照保留原始引用式标题；其它链接、锚点、secret扫描和inventory检查全部保持。该定向例外检查通过。精确差异保存于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-docs-exception.patch</Path>；应对临时副本应用，不能直接改项目规则。结果见 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-docs-exception.log</Path>。

## 执行阶段仍需的证据

每票列出的真实宿主、AI登录、Linux/macOS/Windows、文件mode、真实Git和迁移/重启路径在后续执行Gate验收。原生下载用真实发行资产，不能注入本地helper代替；AI三站PoC须用户登录后真实读回当前轮回答。失败保留在对应票，所有BUG必须修复再核销，不通过缩范围、清数据或额外兜底掩盖。
