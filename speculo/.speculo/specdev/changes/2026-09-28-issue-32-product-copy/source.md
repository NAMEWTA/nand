---
schema_version: 1
artifact: source
change: 2026-09-28-issue-32-product-copy
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/32
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 47d48170c570759d97f80d472eae239160b867a2157b5c1d24426fc79b0e2d7c
remote_state: open
close_capability: supported
---

# Source: 新模块的文案和命名小问题：英文界面仍有中文命令、图标命令和设置项名字对不上、恢复提示写着「Iconic」、介绍窗口没有提到图标/档案等

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 3 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T13:06:37Z / 2026-09-28T00:45:45Z
- Labels: []
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

## 问题概述
本轮检查中文、英文两套界面时发现的一些文案、命名问题，逐条列出。都不影响功能。

## 环境
- 插件：nand 0.0.1（main @ `5af05c6aeee99ae89ce557f1117942757344f585`，本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致）
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English，NAND 语言：中文 / English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件
- 测试时间：2026-09-27 19:25–20:20（UTC+8）

## 复现步骤与实际结果
1. **英文界面仍有一条中文命令**：NAND 语言切到 English，命令面板里有「NAND: 把绝对引用插入当前终端」（`nand:insert-absolute-reference`），其它 57 条都是英文。这条以前的版本就有，之前没报过
2. **图标命令和设置项名字对不上**：
   - 命令「切换极简文件夹图标」↔ 设置项「最小文件夹图标」
   - 命令「切换快速切换图标」↔ 设置项「显示快速切换器图标」
   - 命令 id `nand:toggle-minimal.folder-icons` 中间是点号，其它都是连字符（如果别人给这个命令设了快捷键，以后改 id 会丢，最好趁早统一）
3. **损坏恢复的提示用了上游品牌名**：`iconic.json` 损坏时从备份恢复，提示是「Iconic 加载图标设置时出现问题……」（截图 62）；NAND 里这个模块叫「图标」
4. **介绍窗口没有提到新模块**：首次启用时的介绍窗口写的是「首页可以分别打开看板、编辑器和智能体。」，没有提图标和档案（截图 01）；插件列表里的简介「NAND workbench — board, Markdown comments, and desktop coding agents.」也没有更新
5. **首页和标签栏名称、顺序不一致**：
   - 英文界面首页模块开关叫「Board」，顶部标签叫「Dashboard」（截图 111）
   - 顶部标签顺序「图标」在「档案」前面，首页模块列表「档案」在「图标」前面
6. **右键菜单「更改图标……」**：用了两个省略号（「……」），Obsidian 和 NAND 其它地方都是一个「…」（例如「智能体设置…」）
7. **以前几轮留下的命名问题（仍在）**：
   - 「打开NAND终端」中间没有空格（「打开 NAND 首页」有空格）
   - 「新终端: PowerShell」用半角冒号，其它是「终端：」全角冒号
   - Linux 上也显示「新终端: PowerShell / 命令提示符 / Git Bash」这三个只有 Windows 能用的命令

## 期望结果
- 英文界面没有中文命令
- 同一个功能的命令名和设置名一致
- 提示里用 NAND 自己的模块名
- 介绍窗口包含全部模块

## 截图
![62-iconic-corrupt-restore-notice.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-62-iconic-corrupt-restore-notice.png)
（损坏恢复提示写着「Iconic」）

![01-intro.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-01-intro.png)
（介绍窗口没有图标、档案）

![111-settings-en-home.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-111-settings-en-home.png)
（英文首页：模块开关叫 Board，标签叫 Dashboard；标签栏排不下，Sync 掉到第二行；首页下面也混进了 Rulebook 等图标设置）

## 控制台错误（如有）
```
无
```

## 备注
- 第 7 条在第六、七轮报告里记过，但没有单独建 issue，这里一起列出


## Source Comments

### NAMEWTA · 2026-09-27T15:31:59Z · https://github.com/NAMEWTA/nand/issues/32#issuecomment-5857253180

## 第九轮复测：未修复 ❌

## 测试环境
- 插件：nand 0.0.1，main @ `c3a2034a924d1c23005275221db49b1b5bfd3d30`（2026-09-27 21:30 UTC+8，"Add automation and notifications, report real PTY exit codes, and build terminal servers in CI."），本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致；44 个 `test:*` 全部通过
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English，NAND 语言：中文 / English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件
- 测试时间：2026-09-27 21:34–23:00（UTC+8）

## 结果（本轮中文界面共 80 条 NAND 命令）
- `nand:toggle-minimal.folder-icons`（中间是点号）仍在，名字仍是「切换极简文件夹图标」，设置项叫「最小文件夹图标」
- 「切换快速切换图标」↔ 设置项「显示快速切换器图标」仍不一致
- 右键菜单仍是「更改图标……」（两个省略号）
- 「打开NAND终端」仍没有空格；「新终端: PowerShell / 命令提示符 / Git Bash」仍用半角冒号，Linux 上也显示
- 英文界面首页模块仍叫「Board」，标签叫「Dashboard」（截图 62）
- 介绍窗口和插件简介仍没有提到图标、档案，现在还多了自动化、通知中心没提
- 新增命令「NAND: 自动化」「NAND: 通知中心」没有动词，和「打开档案」等不一致（另写在自动化文案那份新 issue #36 里）


### NAMEWTA · 2026-09-27T23:44:41Z · https://github.com/NAMEWTA/nand/issues/32#issuecomment-5860930095

## ⚠️ 部分修复 / Partially fixed

**复测节点 / Tested at**：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."）
**相关提交 / Related commit**：`0dc97e9`（`docs/agent-upgrade-2026-09-27.md`「Issue 对照」表：Windows 专属命令限制平台，补全文案与功能入口）
**复现率 / Frequency**：剩余问题 1/1 必现（静态文案）

### 测试环境 / Environment
- 插件：nand 0.0.1，本地构建（pnpm 11.1.3），产物与仓库一致：是；仓库自带测试 45/45 个 `test:*` 脚本通过
- 应用：Obsidian 1.13.7（Linux AppImage），界面语言 English，插件语言 中文 / English
- 测试环境：全新测试库 + 全新应用配置目录，只启用本插件
- 测试时间：2026-09-28 06:36–07:47 UTC+8

### 已经好了的 / What's fixed
- 第 1 条：「把绝对引用插入当前终端」已翻译，英文界面为「Insert absolute reference into terminal」；重启后英文界面没有中文命令
- 第 2 条：命令与设置项名字已一致（「切换极简文件夹图标」↔「极简文件夹图标」，「切换快速切换器图标」↔「显示快速切换器图标」）；命令 id 改为 `nand:toggle-minimal-folder-icons`
- 第 3 条：图标设置损坏恢复的提示改为「NAND could not load icon settings.」（按代码核对，本轮没有构造损坏文件实测）
- 第 4 条：介绍窗口和插件简介已提到图标、档案、自动化和通知（截图 1）
- 第 5 条：英文首页模块名与顶部标签一致，都是「Dashboard」（按代码核对；顶部标签实测为 Home / Dashboard / Editor / Agents / Icons / Archives / Automations / Sync）
- 第 6 条：中文右键菜单「更改图标…」只有一个省略号
- 第 7 条：Linux 上不再出现「新终端: PowerShell / 命令提示符 / Git Bash」

### 还没好的 / What still fails
- 第 7 条：「打开NAND终端」（功能区提示、命令名）中间仍没有空格，其它是「打开 NAND 首页」
- 第 6 条（英文）：英文右键菜单是「Change icon...」（三个半角句点），其它地方是「…」，例如「Agent settings…」
- 语言切换后评论、工作流命令名要重启才更新，已记在 #30

### 新发现 / New findings
- 介绍窗口写的是「这是 NAND WTA 的通用工作台」，设置页底部写的是「NAMEWTA 的通用 Obsidian 工作台」，两处说法不一致，请确认是否有意

![19-intro.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-19-intro.png)
（介绍窗口已包含全部模块；注意「NAND WTA」的写法）

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 10 轮复测｜复测节点 `0dc97e9`｜2026-09-28 UTC+8｜保持 OPEN</sub>


### NAMEWTA · 2026-09-28T00:45:45Z · https://github.com/NAMEWTA/nand/issues/32#issuecomment-5861383411

## CTO 决定：作者 / 品牌写法统一为 `NAMEWTA`

**决定时间**：2026-09-28 08:45（UTC+8）
**相关节点**：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（第十轮测试节点）

### 决定内容
- 统一使用 **`NAMEWTA`**，不使用「NAND WTA」。
- 第十轮复测评论里提到：介绍窗口写的是「这是 NAND WTA 的通用工作台」，设置页底部写的是「NAMEWTA 的通用 Obsidian 工作台」。请把介绍窗口等处统一改成 `NAMEWTA`。

### 本 issue 其余待处理项（第十轮结果，不变）
- 「打开NAND终端」缺空格
- 英文菜单「Change icon...」用三个半角句点

下一轮复测时，文案按 `NAMEWTA` 检查。本 issue 保持 OPEN。

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 10 轮复测｜复测节点 `0dc97e9`｜2026-09-28 UTC+8｜保持 OPEN</sub>

