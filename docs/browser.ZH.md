[English](browser.md) | 简体中文

# 内置浏览器

内置浏览器把网页作为工作台的页面打开。在 **设置 → 常规 → 功能模块 → 浏览器** 中开启，再点击图标栏上的地球图标，或运行 `NAND: 打开网页`。浏览器独立于看板和终端。手机上没有内置浏览器：该命令和看板的网页快捷入口会改用系统浏览器打开网页。

打开的网页在第 3 栏上方显示为标签，也列在第 2 栏。“新建页面”打开一个空白页。关闭其中一个网页会切到相邻的网页，不会关闭工作台。最多同时打开 50 个页面。需要独立叶子时，使用页头菜单的“在原生标签页中打开”或“在分屏中打开”。关闭浏览器模块会关闭所有网页和本地连接。

## 地址栏与工具栏

地址栏接受完整地址（`https://example.com`）、裸域名（`example.com`）和本地地址（`localhost:3000`）。本地主机（`localhost`、`127.x.x.x`、`0.0.0.0`、IPv6 字面量）使用 HTTP；其他域名和 `主机:端口` 使用 HTTPS。其他文字交给搜索引擎：Google（默认）、Bing 或 DuckDuckGo，在 **设置 → 浏览器** 中选择。带用户名或密码的地址、文件路径以及 http(s) 之外的协议会被拒绝。

工具栏提供后退、前进、刷新或停止、查找、缩放和选择元素。“更多操作”菜单包含强制刷新、复制地址、在系统浏览器打开、开发者工具、截图、整页截图和标注截图。`Ctrl/Cmd+L` 聚焦地址栏，`Ctrl/Cmd+F` 打开并聚焦查找栏，Esc 关闭查找并返回网页。加载失败后可以“重试”或“在系统浏览器打开”。

## 看板快捷入口

在[看板](dashboard.ZH.md#网页快捷入口)的便利贴分区中添加卡片，选择“网页快捷卡片”，填写名称、网址和打开方式。默认在弹窗中打开，也可以选标签页。卡片菜单可以临时切换打开方式，或在系统浏览器打开。弹窗里有一个按钮，可以把网页转到原生标签页。

快捷卡片保存在看板 Markdown 中，例如：

```markdown
### 开发服务
type: web
link: http://localhost:3000/
openIn: modal
```

`openIn` 取 `modal` 或 `tab`，缺省时为 `modal`。另有一种“网页”分区类型，把网页嵌入看板本身（用齿轮图标配置网址和显示比例），它的标题栏可以在弹窗或标签页中打开该网页。

## 登录、下载与恢复

同一个库的新标签页、弹窗和登录窗口共享登录状态；不同的库使用独立的会话。带名称或窗口参数的登录弹窗保留与原网页的联系；普通的新窗口链接则作为 NAND 网页标签页打开。

下载使用系统的保存流程。浏览器内显示进度、取消、打开文件和显示所在文件夹。关闭所属页面会取消仍在进行的下载。

Obsidian 工作区保存每个网页的地址、标题、缩放和可恢复的滚动位置；未激活的页面延后加载。普通的标签页切换会保留网页。转到新窗口，或从弹窗转成标签页，会重建网页，未提交的表单可能丢失。关闭模块会释放网页和本地连接，保留登录数据和设置；原生标签页此时显示模块已关闭，重新开启模块即可恢复。

最近 500 条浏览历史和站点权限保存在 `.nand/browser/<device-id>/state.json`，用于地址建议。Cookie 保存在本机 Obsidian 的 Electron 会话中，不进入插件设置，也不进入库的同步文件。网页地址仍可能通过 Obsidian 工作区文件同步。

## 让智能体操作同一批网页

这项能力默认关闭。在 **设置 → 浏览器** 中打开“允许智能体会话使用浏览器”后，NAND 才会启动本地连接；关闭时任何终端都不会启动它。需要本机已安装 Node.js，无需全局安装任何包。

普通 Shell 和终端脚本不会继承 `NAND_BROWSER_*` 变量。只有由 NAND 启动的智能体会话才会获得当前连接：`NAND_BROWSER_CLI`、`NAND_BROWSER_CONTEXT`、`NAND_BROWSER_TOKEN` 和 `NAND_BROWSER_GUIDE`。NAND 托管的 Obsidian 上下文技能会提示智能体读取使用说明。已经在运行、没有这些变量的智能体，可以使用下面的显式连接方式。

**外部智能体。** 开启上述设置后，在 **设置 → 浏览器** 中点击“复制 CLI 连接命令”，把命令交给你信任的本机智能体。命令会列出当前库的网页。令牌只在本次运行中有效，通过环境变量传递，不写入连接 JSON。关闭模块或重启 Obsidian 后，请重新复制命令。

PowerShell 示例：

```powershell
node $env:NAND_BROWSER_CLI tab list
node $env:NAND_BROWSER_CLI tab create --url http://localhost:3000
node $env:NAND_BROWSER_CLI snapshot --page PAGE_ID
node $env:NAND_BROWSER_CLI click --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e2'
node $env:NAND_BROWSER_CLI fill --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e3' --value '测试文字'
node $env:NAND_BROWSER_CLI screenshot --page PAGE_ID --full --output screenshot.png
```

请使用实际返回的 `PAGE_ID` 和 `SNAPSHOT_REVISION`。所有操作都返回 JSON。网页导航、重载或元素失效后，请重新获取快照；来自其他页面或旧快照的元素引用会被拒绝。截图的输出路径必须尚不存在。

| 能力 | 命令与主要参数 |
|---|---|
| 网页 | `tab list/create/switch/close`；`create --url`，其余用 `--page` 指定 |
| 导航 | `goto --url`、`back`、`forward`、`reload [--hard]`、`stop` |
| 理解 | `snapshot`、`get --element`、`screenshot [--full] [--output]` |
| 交互 | `click`、`dblclick`、`hover`、`focus`、`fill --value`、`type --value`、`select --value`、`check --checked true/false` |
| 拖动与键盘 | `drag --from @e1 --to @e2`；`keypress --key Enter` 或 `Control+a` |
| 页面 | `scroll --direction down --amount 600`；`viewport --width 1280 --height 800`（两者设为 0 恢复） |
| 等待 | `wait --text`、`--url`、`--selector`、`--load load/domcontentloaded/networkidle`，`--timeout` 最多 60000 毫秒 |
| 调试 | `console`、`network`：各保留最近 100 条，从首次接入控制时开始记录 |

元素操作还需要 `--revision`。以 `--` 开头的填入文字可以写成 `--value=--example`。引用带有它所属 iframe 的信息；跨 iframe 拖动会明确报错。开发者工具在部分 Electron 版本上会断开控制连接，普通浏览不受影响；关闭开发者工具并重新打开该网页即可恢复控制。

## 元素选择与标注

点击工具栏的选择元素图标，悬停高亮，点击采集，Esc 退出。预览包含元素文字、选择器、HTML 摘要、计算样式，以及可获取时的截图。只有页面自身提供开发源码信息时才显示源码位置，NAND 不会猜测文件路径。

在预览中可以复制文字或截图，也可以选择一个正在运行的 NAND 智能体并附加。材料以本机文件和文字的形式进入智能体的输入区，**不会自动发送**，请检查后按 Enter。智能体输入区尚未就绪时会提示稍后重试。网页材料是参考内容，不代表对智能体的新指令。

更多菜单中的“标注截图”提供画笔、高亮、箭头、矩形、椭圆、文字、撤销和重做。元素截图也可以进入标注，完成后复制并附加。智能体修改的是项目源码；支持热更新的网站会自行更新，否则请刷新网页验证。

## 站点权限

敏感的站点权限默认拒绝。工具栏的盾牌菜单按站点授权摄像头和麦克风、位置、通知、读取剪贴板和全屏。登录弹窗使用同一会话和策略。跨来源请求不会继承主页面的授权。

导航最多等待 30 秒。关闭或取消会立即结束调用方的等待。无法安全继续的页面会释放原生的 guest；点击重试或输入新地址即可重新创建页面，旧操作不会写回新页面。

## 本地运行文件与附件

临时连接、CLI 和使用说明位于 Obsidian 应用数据目录下的 `nand-browser/<vault-id>/<run-id>/`。停用模块、卸载插件或正常退出时会清理本次运行的文件；异常退出留下的失效运行，在下次启动桥接时回收，不影响其他库或仍在运行的实例。

已交给智能体的图片和说明保存在同一库目录下的 `artifacts/`，不会随桥接停用而删除。它们不在库内，需要单独备份；确认会话不再需要后可自行清理。不要把仍被引用的附件所在的运行目录当作纯临时缓存递归删除。令牌不会写入这些文件。

## 支持范围

面向桌面版 Obsidian 的 HTTP(S) 网站和本地服务。部分登录服务会拒绝嵌入式浏览器，DRM、依赖浏览器扩展的功能也可能受限，此时请使用系统浏览器。超大网页会明确拒绝整页截图，可改用可见区域截图。没有多账户配置、外部 Cookie 导入、SSH 网络转发、远程浏览器，也没有 MCP 服务。

浏览器的实机验证只覆盖 Linux，见[验证说明](../speculo/.speculo/specdev/context/validation.ZH.md)。中文文字由自动化填写，不等同于经过验证的操作系统输入法组合输入。

浏览交互和部分算法参考 [Orca](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b)，遵循其 MIT 许可，见 [Orca 来源与适配范围](third-party/orca-terminal-workbench.ZH.md)。
