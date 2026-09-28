---
schema_version: 1
artifact: source
change: 2026-09-28-issue-30-live-language-refresh
source_type: github-issue
canonical_locator: https://github.com/NAMEWTA/nand/issues/30
captured_at: 2026-09-28T05:55:43.895113+00:00
content_sha256: 552586520bb8dbc7caa5224c892f859c590a098c1ada1f7ecf29fda05df306e0
remote_state: open
close_capability: supported
---

# Source: 切换 NAND 语言后，自定义的功能区图标丢失、功能区顺序被打乱；功能区提示、命令名、标签页标题要重启才会换语言

## Capture Metadata

- Capture method: GitHub CLI / github-npm-ops issue-read；全部可见评论 2 条。
- Author: NAMEWTA
- Created / updated: 2026-09-27T13:06:35Z / 2026-09-27T23:44:39Z
- Labels: []
- Attachments: 原文中的 URL，不下载到知识库。
- Redactions: 未发现密钥或需脱敏个人信息；测试样本与公开报告原样保留。
- Digest scope: 下方 Original Content 正文起至文件末尾（不含末尾新增换行）。
- Dedup: active 为空；archive source 的相同 canonical_locator 无命中；旧知识归档只有历史复测材料，不是同 locator 的已摄入 change。

## Original Content

## 问题概述
用图标模块给功能区的「打开NAND终端」换成火箭图标后，把 NAND 语言从中文切到英文并重启：火箭图标变回默认的终端图标，NAND 的几个功能区按钮也换了位置。原因是自定义图标和 Obsidian 的功能区顺序都是按"插件 id + 按钮文字"保存的（`nand:打开NAND终端`），按钮文字一翻译，就对不上了。
另外，切换语言后在不重启的情况下，功能区按钮的提示文字、命令面板里的命令名、已打开标签页的标题都还是旧语言；切回中文后命令名仍是英文，要重启才会变。

## 环境
- 插件：nand 0.0.1（main @ `5af05c6aeee99ae89ce557f1117942757344f585`，本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致）
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件，模块全部开启
- 测试时间：2026-09-27 20:05–20:20（UTC+8）

## 复现步骤
1. NAND 语言为中文，右键功能区「打开NAND终端」→「更改图标……」，选火箭（lucide-rocket），重启确认图标保持（截图 61）
2. 设置 → NAND → 首页，把语言切到 English
3. 把鼠标移到功能区按钮上看提示，打开命令面板看命令名
4. 重启 Obsidian，看功能区

## 期望结果
- 切换语言后，自定义的功能区图标和按钮顺序保持不变
- 提示文字、命令名最好立即更新；如果必须重启，界面上应当提示需要重启

## 实际结果
- 第 3 步：功能区提示仍是「打开 NAND 首页」「打开编辑器面板」「打开档案」「打开NAND终端」，命令名也没变
- 第 4 步：「Open terminal」显示默认的 lucide-terminal 图标，火箭没有了；NAND 按钮的顺序从「终端、首页、编辑器、档案 …… 规则书」变成「终端、规则书、首页、编辑器、档案」，在 Obsidian 核心按钮前面（截图 115 对比 61）
- `iconic.json` 里仍然是 `"ribbonIcons": {"nand:打开NAND终端": {"icon": "lucide-rocket"}}`；`workspace.json` 的 `left-ribbon.hiddenItems` 也全是中文按钮名
- 再切回中文，不重启时命令名仍是英文

## 截图
![61-after-restart-icons.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-61-after-restart-icons.png)
（中文：功能区第一个按钮是火箭）

![115-en-after-restart.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r8-115-en-after-restart.png)
（切到英文并重启：火箭没了，按钮顺序变了）

## 控制台错误（如有）
```
无
```

## 备注
- Obsidian 自己用"插件 id:按钮文字"作为功能区按钮的标识（顺序、隐藏状态都靠它），所以按钮文字随语言变化时，顺序和隐藏设置都会丢。可以考虑功能区按钮文字固定用一种语言，或者切换语言时把 `ribbonIcons` 和 `left-ribbon` 里的键一起改名（仅为建议）
- 同样的问题也会影响用户在 Obsidian 里隐藏的 NAND 功能区按钮（切换语言后会重新出现），这一点本轮没有专门测试


## Source Comments

### NAMEWTA · 2026-09-27T15:31:58Z · https://github.com/NAMEWTA/nand/issues/30#issuecomment-5857252921

## 第九轮复测：仍未修复 ❌（英文 → 中文方向同样丢失）

## 测试环境
- 插件：nand 0.0.1，main @ `c3a2034a924d1c23005275221db49b1b5bfd3d30`（2026-09-27 21:30 UTC+8，"Add automation and notifications, report real PTY exit codes, and build terminal servers in CI."），本地 pnpm 11.1.3 构建，产物与仓库 main.js 一致；44 个 `test:*` 全部通过
- Obsidian：1.13.7（Linux AppImage），Obsidian 界面语言：English，NAND 语言：中文 / English
- 测试库：全新干净库 + 全新 Obsidian 配置目录，只启用本插件
- 测试时间：2026-09-27 21:34–23:00（UTC+8）

## 结果
1. NAND 语言为 English，右键功能区「Open terminal」→「Change icon...」→ 选火箭，功能区立即显示火箭（截图 74）
2. 设置里把语言切回中文：不重启时功能区提示仍是英文，只有「打开规则书」变成了中文
3. 重启后功能区第一个按钮「打开NAND终端」变回默认终端图标，火箭没了（截图 76）
- `iconic.json` 里是 `"ribbonIcons": {"nand:Open terminal": {"icon": "lucide-rocket"}}`，键里带着按钮的显示文字，切换语言后就对不上

![74-ribbon-rocket-en.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-74-ribbon-rocket-en.png)
（英文：功能区第一个按钮是火箭）

![76-ribbon-zh-after-restart.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r9-76-ribbon-zh-after-restart.png)
（切回中文并重启：火箭没了）


### NAMEWTA · 2026-09-27T23:44:39Z · https://github.com/NAMEWTA/nand/issues/30#issuecomment-5860929894

## ⚠️ 部分修复 / Partially fixed

**复测节点 / Tested at**：`0dc97e9fbf17f30452a2a3ec4aa0ee3fadeb2b6e`（2026-09-28 06:29:38 UTC+8，"Add the six-agent workbench, harden automation persistence, and archive the September SpecDev changes."）
**相关提交 / Related commit**：`0dc97e9`（`docs/agent-upgrade-2026-09-27.md`「Issue 对照」表：功能区 ID 与显示语言解耦；切换语言更新标题和已注册命令名称）
**复现率 / Frequency**：主问题 0/3；剩余问题 2/2（中→英、英→中各 1 次）

### 测试环境 / Environment
- 插件：nand 0.0.1，本地构建（pnpm 11.1.3），产物与仓库一致：是；仓库自带测试 45/45 个 `test:*` 脚本通过
- 应用：Obsidian 1.13.7（Linux AppImage），界面语言 English，插件语言 中文 / English
- 测试环境：全新测试库 + 全新应用配置目录，只启用本插件
- 测试时间：2026-09-28 06:36–07:47 UTC+8

### 已经好了的 / What's fixed
- 功能区按钮改用固定 ID（`nand:ribbon-terminal`、`nand:ribbon-home` 等），自定义图标存为 `"nand:ribbon-terminal": {"icon": "lucide-rocket"}`
- 把「打开NAND终端」换成火箭图标、在 Obsidian 功能区右键菜单里隐藏「打开规则书」，然后中文 → English → 中文切换并重启：火箭图标保留，「打开规则书」保持隐藏，NAND 按钮顺序不变（截图 1）
- 切换语言后不重启，功能区按钮的提示文字立即更新；大部分命令名（终端、图标、自动化、档案、看板相关）立即更新

### 还没好的 / What still fails
1. 插件语言从中文切到 English，不重启，打开命令面板
2. 再从 English 切回中文，不重启，打开命令面板；看已经打开的标签页标题

- 第 1、2 步：下面 9 条命令名不跟着切换，要重启才会变：「给选区加评论」「复制相对引用」「复制绝对引用」和 6 条「工作流：Claude Code / Codex / Grok / OpenCode / Gemini CLI / Pi」（切回中文时反过来仍是 Comment on selection、Workflow: … 等英文）
- 已打开的标签页标题（「档案」「自动化」「工作台」「Terminal」）不跟着切换；视图内容会重新渲染成新语言，但标题要等视图重新加载。重启后如果标签页还没加载，标题仍是上一次的语言（截图 2：中文界面里「Automations」标签页）

### 建议 / Suggestion
- 评论、工作流这两组命令也在语言切换时更新名称
- 语言切换时刷新已打开 NAND 视图的标题（`leaf.updateHeader()` 之类），或在设置里提示「部分名称重启后生效」

![16-ribbon-rocket-after-lang-restart.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-16-ribbon-rocket-after-lang-restart.png)
（切换语言并重启后：火箭图标仍在、规则书仍隐藏；标签栏里仍有英文标题「Automations」）
![22-automation-view-en.png](https://gist.githubusercontent.com/NAMEWTA/055537ff620ae786bd57e0033896754f/raw/nand-r10-22-automation-view-en.png)
（切到英文后，自动化视图内容已是英文，但标签页标题和视图标题仍是「自动化」）

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 10 轮复测｜复测节点 `0dc97e9`｜2026-09-28 UTC+8｜保持 OPEN</sub>

