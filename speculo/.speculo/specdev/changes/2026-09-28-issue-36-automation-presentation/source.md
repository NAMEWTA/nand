---
schema_version: 1
artifact: source
change: 2026-09-28-issue-36-automation-presentation
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/36
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 221fb8e02d6f1a02fb32e70edd53782810c0ec02dbf99ad7e53cb8a7ff78acbc
remote_state: open
close_capability: supported
---

# Source: 自动化和通知中心的文案、错误提示和界面问题：英文硬编码提示、智能体失败原因误报、通知中心缺少全部已读 / 清空、「打开」跳到原始 Markdown、删除没有确认等

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 1 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T15:31:49Z / 2026-09-27T23:44:42Z
- Labels: []
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

## 问题概述
测试新的自动化和通知中心时发现的一些文案、错误提示和界面问题，逐条列在下面。数据写入失败（#34）和「新建待办」卡死（#35）是另外两个严重问题，已经单独写了，这里不重复。

说明：下面第 2–4 部分里需要运行任务才能看到的项目，是在我临时修补 `adapter.rename`（为了绕开数据写不进去的问题）之后测的，只影响写文件，和这些界面问题无关。

## 环境
- 插件：nand 0.0.1（main @ `c3a2034a924d1c23005275221db49b1b5bfd3d30`，2026-09-27 21:30 UTC+8，本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致）
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English，NAND 语言：中文 / English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件
- 测试时间：2026-09-27 21:36–22:20（UTC+8）

## 复现步骤与实际结果

### 1. 错误提示
1. **重复规则写错时提示是英文**：运行方式选「重复执行」，规则填 `abc`，保存后提示「Invalid recurrence」（截图 23）。`validateSchedule` 里的几条提示都是写死的英文，没有走 i18n
2. **字段不合法时提示没有说是哪个字段**：名称或内容为空、补执行宽限填 `abc`，都只提示「请检查任务字段和时间规则」（截图 07）。期望指出具体字段，例如「请填写名称」「补执行宽限必须是 0 或正整数」
3. **智能体失败原因误报**：
   - 选一个没有启用 / 没有安装的智能体（例：aider），工作目录 `/tmp`，立即运行，失败原因显示「桌面终端模块不可用」，但终端模块是开着的（截图 42）。代码里"智能体未启用"和"找不到 CLI"都用了 `automation.agentUnavailable` 这一条文案
   - 工作目录不存在时，失败原因是「请检查任务字段和时间规则」，看不出是目录问题
   - 智能体下拉框列出了全部 40 多个智能体，包括没启用的；名字有的是显示名（Claude Code、Codex），有的是原始 id（openclaude、autohand、mimo-code、prime-agent…）
4. **运行历史里的失败原因按运行时的语言存下来了**：切到英文后，历史和通知里还是「桌面终端模块不可用」「请检查任务字段和时间规则」「失败: …」（截图 64）
5. 通知正文里「失败: …」「应用内: 已提交」用的是半角冒号

### 2. 行为
1. **删除没有确认**：点「删除」直接删掉，连运行历史一起没了（截图 33）
2. **「指定时间」可以选过去的时间**：保存后马上执行，没有提示
3. **编辑后这一项跑到列表最后**
4. **通知中心「打开」**：
   - 看板待办提醒的「打开」会在新标签页打开 `dashboard.md` 的原始 Markdown（能看到 JSON），不是看板视图；通知中心窗口也没关，挡在前面（截图 51）
   - 档案提醒的「来源」同样打开原始笔记，能看到 `nand:reminders` 的 JSON 代码块，而不是档案面板
   - 没有来源的通知，「打开」只是标为已读
5. 看板待办提醒默认把待办文字同时填进名称和内容，提醒弹出来是两行一样的文字（截图 49）

### 3. 通知中心界面（截图 29）
1. 正文、时间、投递状态挤在一行，正文里的换行也被合并
2. 时间是英文格式「9/27/2026, 9:44:21 PM」，中文界面里显得突兀（自动化运行历史也是这个格式）
3. 没有「全部已读」「清空」，也没有空状态提示；功能区铃铛上没有未读数
4. 已读后「标为已读」按钮只是变灰，还占着位置

### 4. 自动化管理页和编辑器
1. 顶部两个「全部」下拉框没有标签，看不出一个是状态、一个是智能体；搜索框样式和旁边的按钮、下拉框不一致（截图 05）
2. 列表很长时，选中下面的项目，右边详情会跟着整页滚走，看不到标题和按钮（截图 64）
3. 详情里的正文用等宽字体（`<pre>`）显示
4. 编辑器标题新建和编辑都叫「自动化」；「通知渠道」小标题比上下的行向右缩进；「补执行宽限（分钟）」输入框比其它控件缩进；左边提示词框下面大片空白（截图 40）
5. 命令名「NAND: 自动化」「NAND: 通知中心」没有动词，和「NAND: 打开档案」「NAND: 打开编辑器面板」不一致

### 5. 设置页「自动化」标签（截图 04、63）
1. 自动化这一组显示在标签栏**上面**，标签栏下面接着是图标模块的设置（和 #27 同一个问题）
2. 「自动化」出现两次（分组标题 + 一行「自动化 / 打开」）；「通知渠道」「会话方式」只有说明文字，没有任何控件，看起来像坏掉的设置项
3. 中文界面标签多了「自动化」后，「同步」被挤到第二行（截图 03）
4. 首页模块列表里没有自动化的开关；首次启用的介绍窗口也没有提到自动化和通知中心

## 期望结果
见每条说明。

## 截图
![23-invalid-cron-notice.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-23-invalid-cron-notice.png)
（重复规则写错：英文提示「Invalid recurrence」）

![07-empty-save-notice.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-07-empty-save-notice.png)
（字段为空：只提示「请检查任务字段和时间规则」）

![42-agent-run-missing-cli.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-42-agent-run-missing-cli.png)
（智能体 aider 未启用 / 未安装：失败原因却是「桌面终端模块不可用」）

![29-inbox.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-29-inbox.png)
（通知中心：正文、时间、状态挤在一行，时间是英文格式，没有全部已读 / 清空）

![51-inbox-open-dashboard-source.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-51-inbox-open-dashboard-source.png)
（看板提醒点「打开」：打开的是 dashboard.md 原文，通知中心窗口还挡在前面）

![64-automation-view-en.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-64-automation-view-en.png)
（英文界面：历史里的失败原因还是中文；详情区随列表滚走）

![33-after-delete-no-confirm.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-33-after-delete-no-confirm.png)
（删除没有确认）

![05-automation-view-empty.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-05-automation-view-empty.png)
（两个没有标签的「全部」下拉框）

![40-editor-agent-filled.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-40-editor-agent-filled.png)
（编辑器：「通知渠道」标题、宽限输入框缩进不齐）

![04-settings-automation.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-04-settings-automation.png)
（设置「自动化」标签：分组在标签栏上面，下面是图标设置；「通知渠道」「会话方式」没有控件）

![63-settings-automation-tab-en.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-63-settings-automation-tab-en.png)
（英文界面同样的问题）

## 控制台错误
```
无
```


## Source Comments

### NAMEWTA · 2026-09-27T23:44:42Z · https://github.com/NAMEWTA/nand/issues/36#issuecomment-5860930216

## ⚠️ 部分修复 / Partially fixed

**复测节点 / Tested at**：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."）
**相关提交 / Related commit**：`0dc97e9`（`docs/agent-upgrade-2026-09-27.md`「Issue 对照」表：细化校验与错误码；保存保留列表位置，删除保留运行快照；补齐来源跳转、收件箱已读／清理、未读数、独立投递回执及历史清理）
**复现率 / Frequency**：剩余问题 1/1 必现（静态界面）；误报原因 3/3

### 测试环境 / Environment
- 插件：nand 0.0.1，本地构建（pnpm 11.1.3），产物与仓库一致：是；仓库自带测试 45/45 个 `test:*` 脚本通过
- 应用：Obsidian 1.13.7（Linux AppImage），界面语言 English，插件语言 中文 / English
- 测试环境：全新测试库 + 全新应用配置目录，只启用本插件
- 测试时间：2026-09-28 06:36–07:47 UTC+8

### 已经好了的 / What's fixed
- 1.1 重复规则写 `abc`、`61 25 * * *`、`FREQ=BOGUS`：提示「请输入支持的 Cron 或 RRULE 周期规则」（截图 1）
- 1.2 字段提示具体到字段：「请填写名称」「请填写提示词或内容」「请至少选择一个通知渠道」「宽限必须为非负的分钟数」（`-5`、`abc` 都拦住）
- 1.3 智能体下拉框只列已安装的智能体，名字是显示名
- 2.1 删除有确认「删除此自动化？运行历史将保留。」，删除后仍能看运行历史
- 2.2 指定时间选过去会提示「请选择未来时间，或使用马上执行。」
- 2.3 编辑后列表位置和选中项保持不变
- 2.4 通知中心「打开」：待办提醒进入看板视图（截图 2），档案提醒进入档案面板并选中记录，运行通知进入自动化页并选中那次运行；通知中心会关闭
- 3.1 通知分行显示；3.2 通知中心时间是中文格式 `2026/9/28 07:09:44`；3.3 有「全部已读」「清理已读通知」、空状态「暂无通知」、功能区铃铛未读数、标题「通知中心 (3)」；3.4 已读后「标为已读」按钮隐藏（截图 3）
- 5.1 设置页自动化分组在自己的标签页内（#27）；5.4 介绍窗口已提到自动化和通知

### 还没好的 / What still fails
- 1.3 本机没装 Claude Code 时运行，失败原因是「请先手动启动一次该智能体，确认已配置的权限模式」，没有说找不到 CLI；工作目录不存在时也是这句，没有提到目录。另外下拉框为空时会默认保存成 Claude Code，已另开 #38
- 1.4 运行历史和通知里的失败原因仍按运行时的语言保存：切到英文后，旧记录仍是中文，新记录是英文，同一列表里混在一起
- 1.5 「失败: …」「应用内: 已提交」「下次执行: …」仍是半角冒号
- 3.2（自动化页）运行历史和「下次执行」仍是英文格式 `9/28/2026, 7:13:13 AM`
- 2.5 看板待办提醒默认把待办文字同时填进名称和内容，提醒仍是两行一样的文字
- 4.1 顶部两个「全部」下拉框仍没有标签（英文界面是两个「All」，截图 4）
- 4.2 列表长时整个页面一起滚动，选中下面的项目后顶部按钮和详情标题会滚出视野
- 4.3 详情里的提示词仍是等宽字体
- 4.4 编辑器标题新建、编辑都叫「自动化」；「通知渠道」小标题仍比上下行缩进
- 4.5 命令「NAND: 自动化」「NAND: 通知中心」仍没有动词
- 5.2 设置 → 自动化里「通知渠道」「会话方式」仍只有说明文字没有控件
- 5.4 首页模块列表里仍没有自动化的开关
- 另：删除了运行历史（「清理已结束的历史」）后，已经执行过的一次性提醒又显示「待执行」

![15-cron-error-zh.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-15-cron-error-zh.png)
（重复规则写错：中文提示）
![23-inbox-open-todo.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-23-inbox-open-todo.png)
（待办提醒点「打开」进入看板视图）
![14-inbox.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-14-inbox.png)
（通知中心：分行显示、中文时间、全部已读 / 清理已读、未读数）
![22-automation-view-en.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-22-automation-view-en.png)
（英文界面：两个没有标签的「All」下拉框）

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 10 轮复测｜复测节点 `0dc97e9`｜2026-09-28 UTC+8｜保持 OPEN</sub>

