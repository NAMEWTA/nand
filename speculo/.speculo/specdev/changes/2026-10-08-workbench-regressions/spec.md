---
schema_version: 3
artifact: "spec"
change: "2026-10-08-workbench-regressions"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

# Spec: 工作台导航、常规设置与图标语言回归

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 3 票、5 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

修复medium覆盖层吞rail点击、模块图标位置错误和实时切换语言后的原生下拉裁切。

### 规划时基线

shell scrim inset0覆盖rail；home模块图标CSS仅命中原生设置祖先；bindLocalizedOptions只改选项DOM未刷新原生测量。根因来自源码与issue宿主观察，待本票定向重现。

### 目标用户与场景

- 作为用户，我能在覆盖侧栏打开时一次切到其他模块。
- 作为用户，我在两种设置入口都能读清图标、开关和切换后的中文。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- 重设计模块设置、增加view type、覆盖Obsidian全局控件CSS

## 2. 解决方案与外部行为

打开medium侧栏后，点其他rail图标直接导航至该模块上次位置并关闭overlay；Esc和scrim点击仍关闭，键盘焦点能够访问可见rail。narrow导航依旧在dialog内，关闭恢复触发按钮。

原生设置窗和工作台常规模块行均显示名称左侧32px muted图标方块，开关独立、名称/描述不挤压。

语言从English切中文再返回已渲染图标设置，下拉保持值，所有选项与测量文字一致；中文长项完整可见，切回英文也正确。切换/重载不重复监听或调用持久化。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为用户，我能在覆盖侧栏打开时一次切到其他模块。
- **US-002**：作为用户，我在两种设置入口都能读清图标、开关和切换后的中文。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | medium侧栏overlay已打开 | 点档案/首页/自动化rail一次 | 一次导航且overlay关闭，恢复模块位置 | Shell selectRail +真实点击 |
| AC-002 | medium/narrow overlay与popout | Tab/ShiftTab/Esc、scrim点击 | 可见rail可键盘操作，narrow模态/焦点恢复保持，无点击穿透page | 真实Obsidian主窗/popout |
| AC-003 | 工作台和Obsidian两种常规设置入口 | 查看/操作模块行 | 图标在名称左32px方块，开关不相贴可用；多主题宽度可读 | Setting DOM+截图 |
| AC-004 | 英文已渲染Icons再即时切中文 | 选择仅限移动设备并往返语言 | 中文完整显示，测量与文字一致，值不变、无额外保存 | 真实Dropdown与语言切换 |
| AC-005 | 图标设置重开/模块重启 | 反复切语言和下拉值 | 监听不累积，规则对话框等复用者不退化 | localized-dom及宿主回归 |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- #138/#139/#140三条BUG全部修复并真实宿主核验

### REUSE

- Shell布局与focus恢复、原生Setting/Dropdown、localized-dom绑定

### OUT

- **OOS-001**：重设计模块设置、增加view type、覆盖Obsidian全局控件CSS

## 6. 已锁定实现约束

- **DEC-001**：medium rail始终可单击切换并关闭侧栏，narrow保留对话框内横向rail；不取消窄屏模态保护。 来源：LOG-001；#138+ui skill。
- **DEC-002**：更新所有下拉选项及原生宽度测量，不触发额外保存、不硬编码中文宽度。 来源：LOG-002；#140。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

无公共接口/数据格式/迁移。若本地化需要持有控件刷新函数，以控件/页面生命周期注册释放；不把原生私有测量DOM当公共合同。

## 8. 非功能要求

- **NFR-001**：用户数据仍以既有Markdown/命名空间为权威；日志不得出现凭据或非必要正文。
- **NFR-002**：按issue指定规模实测，不编造性能阈值；查询/渲染热路径不增加全库磁盘扫描。
- **NFR-003**：模块关闭/页面销毁释放监听、命令和任务；失败不能吞掉或覆盖用户数据。
- **NFR-004**：状态、失败步骤、可恢复操作可观察；未验证平台如实标注。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-002 | 1280×740且Obsidian左栏展开，依次单击档案/首页/自动化; 覆盖层内Tab循环与Esc、page scrim点击；narrow同组操作; pnpm test:workbench-lifecycle; pnpm run lint:css; 真实popout | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-003 | 工作台设置→常规模块，Obsidian设置→NAND同屏对照; 长中文名称、窄面板、打开全部模块; pnpm run lint:css; pnpm run build | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-02.md</Path> |
| T-03所列稳定入口 | 真实host/系统集成或定向单元 | AC-004, AC-005 | 按#140原步骤，选择仅限移动设备，切回英文; 设置页销毁后切语言再重开; pnpm test:i18n; pnpm exec vitest run src/ui src/modules/icons | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/evidence/T-03.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- medium视觉可点击但dialog focus trap排除rail会留下键盘bug；同时检查焦点范围。
- Dropdown.setValue是否真正重测须真实宿主验证，不凭stub成功结论。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
