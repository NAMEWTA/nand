---
schema_version: 1
artifact: source
change: 2026-09-28-issue-31-contacts-polish
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/31
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: fc4748324f20813df465e8175beeb979a017d19d069390295357de0a60f8e471
remote_state: open
close_capability: supported
---

# Source: 档案模块的几个小问题：删除后重启显示「关联的记录已删除」、关系表单按钮叫「清除筛选」、筛选里显示文件路径、联系人文件多出 website 字段、文件里的小节标题是英文等

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 2 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T13:06:36Z / 2026-09-27T23:44:40Z
- Labels: []
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

## 问题概述
测试新增的档案模块时发现的一些小问题，逐条列在下面。都不影响数据，但会让界面显得不完整。（保存卡死是另一个严重问题，见 #26，这里不重复。）

## 环境
- 插件：nand 0.0.1（main @ `5af05c6aeee99ae89ce557f1117942757344f585`，本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致）
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English，NAND 语言：中文 / English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件；档案资料文件夹 `资料/档案`
- 测试时间：2026-09-27 19:47–20:20（UTC+8）

## 复现步骤与实际结果
1. **删除后重启显示「关联的记录已删除」**：打开一条记录的详情页 → 删除 → 确认（文件进入 `.trash`，界面回到列表）→ 重启 Obsidian。档案标签页恢复后显示「The linked record was deleted or is outside this folder.」，要点返回箭头才回到列表。`workspace.json` 里的视图状态还留着已删除记录的 `selectedPath`（`资料/档案/联系人/张三-783047a2.md`）。期望：删除后清掉 `selectedPath`，重启后直接显示列表（截图 116）
2. **关系表单的清除按钮文字不对**：新增人际关系窗口里，「关联企业（可选）」下面清除所选企业的按钮叫「清除筛选」，英文是「Clear filters」。这里不是筛选，期望叫「清除」/「Clear」（截图 91）
3. **筛选面板显示文件路径**：打开筛选，「当前公司」里的选项显示为「星河科技 · 资料/档案/企业/星河.md」，路径很长而且对用户没用；「曾任公司」列出了没有离职员工的企业；「当前公司」「曾任公司」「标签」等小标题比下面的选项向右缩进，没有对齐（截图 100）
4. **联系人文件多出 website 字段**：新建的联系人文件 frontmatter 里有 `website: ""`，而《档案格式说明》把 `website` 写成企业字段（「企业网址」）
5. **文件里的小节标题是英文**：联系人文件里是 `## employments`、`## relations`、`## traits`、`## habits`、`## notes`，表头也是 `company | department | title ...`，中文用户直接打开原始笔记会觉得奇怪。《档案格式说明.md》也是中英文混排，大段说明只有英文
6. **其它界面细节**：
   - 张三的「基本资料」卡片没有内容时是空白，没有「暂无记录」之类的占位（其它小节会显示「尚未填写」）
   - 新增窗口的字段名是「姓名／企业名称」，但这个窗口已经分成联系人/企业两种；编辑窗口的标题都只写「编辑」，新增人际关系也叫「编辑」，看不出在做什么（截图 91）
   - 列表为空时也显示「上一页 / 第 1 页 / 下一页」分页条
   - 张三的卡片标题和别的卡片相比向右偏了一点
   - 企业改名后文件名不变（仍是 `星河.md`）；如果是有意设计，建议在文档里说明

## 期望结果
见每条说明。

## 截图
![116-contacts-restored-deleted-record.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-116-contacts-restored-deleted-record.png)
（删除记录后重启：显示「The linked record was deleted or is outside this folder.」）

![91-contacts-relation-form.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-91-contacts-relation-form.png)
（关系表单：清除企业的按钮叫「清除筛选」）

![100-contacts-filter-open.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-100-contacts-filter-open.png)
（筛选面板：选项里带文件路径，标题没对齐）

## 控制台错误（如有）
```
无
```

## 备注
- 第 2 条英文界面里同样是「Clear filters」
- 删除、外部修改后刷新、同名联系人、公司关键人物、反向关系、搜索、筛选、排序、模块开关、英文界面都测过，工作正常


## Source Comments

### NAMEWTA · 2026-09-27T15:31:58Z · https://github.com/NAMEWTA/nand/issues/31#issuecomment-5857253049

## 第九轮复测：未修复（代码未改动），部分项目因 #26 仍无法复测

## 测试环境
- 插件：nand 0.0.1，main @ `c3a2034a924d1c23005275221db49b1b5bfd3d30`（2026-09-27 21:30 UTC+8，"Add automation and notifications, report real PTY exit codes, and build terminal servers in CI."），本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致；44 个 `test:*` 全部通过
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English，NAND 语言：中文 / English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件
- 测试时间：2026-09-27 21:34–23:00（UTC+8）

## 结果
- 这次提交对档案模块只加了提醒相关代码（`reminders.ts`、记录菜单「新建自动化」），表单、筛选、文件格式相关代码没有改，原来列的几项应当都还在
- 因为 #26 保存仍然卡死，本轮没法通过表单新建记录。我按《档案格式说明》手写了一个联系人文件来测，列表和详情能正常显示
- 补充一条：不重启直接把语言切成 English，详情页的「性格与偏好」「生活习惯」这类自由文字小节仍显示中文「尚未填写」，其它标签已变成英文（这些小节用 `MarkdownRenderer` 渲染后没有随语言刷新）
- 新增的「更多操作 → 新建自动化」可用：保存后提醒写进记录文件的 `<!-- nand:reminders -->` 区域，没有卡死；在自动化页立即运行，提醒正常弹出（截图 58，是在临时修补自动化数据写入问题之后测的）

![58-contacts-reminder-run.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-58-contacts-reminder-run.png)
（档案记录提醒：立即运行后出现提醒，详情里有「来源」按钮）


### NAMEWTA · 2026-09-27T23:44:40Z · https://github.com/NAMEWTA/nand/issues/31#issuecomment-5860929993

## ⚠️ 部分修复 / Partially fixed

**复测节点 / Tested at**：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."）
**相关提交 / Related commit**：`0dc97e9`（`docs/agent-upgrade-2026-09-27.md`「Issue 对照」表：修复筛选现任／曾任人员、类型专属属性、语言切换表头、同名选择器及失效选中状态）
**复现率 / Frequency**：剩余问题 1/1 必现（界面静态问题）

### 测试环境 / Environment
- 插件：nand 0.0.1，本地构建（pnpm 11.1.3），产物与仓库一致：是；仓库自带测试 45/45 个 `test:*` 脚本通过
- 应用：Obsidian 1.13.7（Linux AppImage），界面语言 English，插件语言 中文 / English
- 测试环境：全新测试库 + 全新应用配置目录，只启用本插件
- 测试时间：2026-09-28 06:36–07:47 UTC+8

### 已经好了的 / What's fixed
- 删除记录后重启，列表正常显示，不再显示「关联的记录已删除」（截图 1）
- 筛选里不再显示文件路径；「曾任公司」只列出有离职人员的企业
- 联系人文件不再有 `website` 字段，企业文件只保留企业字段；文件里的小节标题、表头是中文，切到英文界面保存后表头不变、能正常读取
- 保存不再卡死（#26 已关闭）

### 还没好的 / What still fails
- 人际关系表单里，关联企业旁的按钮仍叫「清除筛选」，这里应当是「清除」或「不关联企业」（截图 2）
- 新建人际关系的弹窗标题是「编辑」，新建时应为「新建人际关系」（截图 2）
- 筛选弹窗里分组标题（当前公司、曾任公司、当前地区…）比选项向右缩进，层级看起来是反的（截图 3）
- 联系人和企业表单的名称字段都叫「姓名／企业名称」，应分别叫「姓名」「企业名称」
- 基本资料卡片没填内容时是空白，没有「尚未填写」之类的占位（其它卡片有）
- `档案/档案格式说明.md` 仍是中英文混写

![21-contacts-after-delete.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-21-contacts-after-delete.png)
（删除记录后重启：列表正常）
![08-contacts-validation.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-08-contacts-validation.png)
（人际关系表单：标题「编辑」，按钮「清除筛选」）
![20-contacts-filter.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-20-contacts-filter.png)
（筛选：分组标题比选项缩进更多）

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 10 轮复测｜复测节点 `0dc97e9`｜2026-09-28 UTC+8｜保持 OPEN</sub>

