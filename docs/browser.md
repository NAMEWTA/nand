# 浏览器

在 NAND 设置的“首页”开启“浏览器”，然后点击侧边栏地球图标，或运行“NAND：打开网页”。浏览器独立于看板和终端模块。

网页使用 Obsidian 原生标签页，可以固定、拖动、分屏及移到新窗口。地址栏支持 `https://example.com`、`example.com` 和 `localhost:3000`；本地地址使用 HTTP，普通域名使用 HTTPS。其他文本交给搜索引擎，默认 Google，可在“浏览器”设置页修改。

工具栏提供前进、后退、刷新／停止、查找、缩放、元素选择。更多菜单包含强制刷新、复制地址、系统浏览器打开、开发者工具、截图、整页截图和截图标注。`Ctrl/Cmd+L` 聚焦地址栏，`Ctrl/Cmd+F` 查找。加载失败后可以重试或在系统浏览器打开。

## 看板快捷入口

在“便利贴”区块点击添加，选择“网页快捷卡片”，填写名称、URL 和打开方式。默认在 Obsidian 内部大弹窗打开，也可选择标签页。卡片菜单可临时切换打开方式，或者在系统浏览器打开。弹窗右上角可以将网页转到原生标签页。

已有内嵌网页区块的标题栏也提供“弹窗打开”和“标签页打开”。原有链接卡片、内嵌网页及其登录状态保持原来的行为。手机上的网页快捷入口使用系统浏览器。

快捷卡片保存到看板 Markdown，例如：

```markdown
### 开发服务
type: web
link: http://localhost:3000/
openIn: modal
```

`openIn` 可使用 `modal` 或 `tab`，省略时默认 `modal`。

## 登录、下载和恢复

同一 Vault 的新浏览器标签页、弹窗和登录窗口共享登录状态。不同 Vault 使用独立会话；已有看板内嵌网页的 Cookie 不自动导入。命名或带窗口参数的登录弹窗保留与原网页的通信，普通新窗口链接打开为 NAND 网页标签页。

下载使用系统保存流程，浏览器内显示进度、取消、打开文件和显示所在文件夹。关闭所属页面会取消仍在进行的下载。

Obsidian 工作区保存网页地址、标题、缩放和可恢复的滚动位置；未激活页面延迟加载。普通标签页切换保留网页实例，转到新窗口或从弹窗转标签页会重建网页，未提交表单可能丢失。关闭模块会释放网页与本地连接，保留登录数据和设置；原生标签页显示停用提示，重新开启模块即可恢复。

最近 500 条浏览历史及站点授权保存在 `.nand/browser/<device-id>/state.json`，用于地址建议。Cookie 保存在本机 Electron 会话中，不进入插件设置或 Vault 同步文件。网页地址仍可能通过 Obsidian 工作区文件同步。

## Agent 操作同一网页

需要本机 Node.js，无需全局安装包。在 NAND 内新启动的 Agent 会继承 `NAND_BROWSER_CLI`、`NAND_BROWSER_CONTEXT`、`NAND_BROWSER_TOKEN` 和 `NAND_BROWSER_GUIDE`。受管 Obsidian 上下文技能会提示 Agent 读取浏览器调用说明。已运行的 Agent 若没有这些变量，可使用下述显式连接方式。

外部 Agent：在设置 → 浏览器点击“复制 CLI 连接”，将命令交给本机 Agent。命令列出当前 Vault 的网页；连接令牌仅在本次运行有效，通过环境变量交付，不写入连接 JSON；复制的连接命令仅供你信任的本机 Agent 使用。关闭模块或重启 Obsidian 后，应重新复制连接。

PowerShell 示例：

```powershell
node $env:NAND_BROWSER_CLI tab list
node $env:NAND_BROWSER_CLI tab create --url http://localhost:3000
node $env:NAND_BROWSER_CLI snapshot --page PAGE_ID
node $env:NAND_BROWSER_CLI click --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e2'
node $env:NAND_BROWSER_CLI fill --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e3' --value '测试文字'
node $env:NAND_BROWSER_CLI screenshot --page PAGE_ID --full --output screenshot.png
```

`PAGE_ID` 和 `SNAPSHOT_REVISION` 使用实际返回值。所有操作返回 JSON。网页导航、重载或元素失效后重新获取快照；不同页面或旧快照的元素引用会被拒绝。截图输出路径必须尚不存在。

| 能力 | 命令与主要参数 |
|---|---|
| 网页 | `tab list/create/switch/close`；`create --url`，其余指定 `--page` |
| 导航 | `goto --url`、`back`、`forward`、`reload [--hard]`、`stop` |
| 理解 | `snapshot`、`get --element`、`screenshot [--full] [--output]` |
| 交互 | `click`、`dblclick`、`hover`、`focus`、`fill --value`、`type --value`、`select --value`、`check --checked true/false` |
| 拖动／键盘 | `drag --from @e1 --to @e2`；`keypress --key Enter` 或 `Control+a` |
| 页面 | `scroll --direction down --amount 600`；`viewport --width 1280 --height 800`，两者设为 0 恢复 |
| 等待 | `wait --text`、`--url`、`--selector`、`--load load/domcontentloaded/networkidle`，`--timeout` 最多 60000 毫秒 |
| 调试 | `console`、`network`，最多保留各 100 条；记录从首次接入控制时开始 |

元素操作还需 `--revision`。以 `--` 开头的填入文字可以写成 `--value=--example`。操作不同 iframe 时引用已携带其所属上下文；跨 iframe 拖动会明确报错。DevTools 在部分 Electron 版本上会断开控制连接，普通浏览继续可用；关闭 DevTools 后重开该网页即可恢复控制。

## Design Mode 与标注

点击工具栏的元素选择图标，悬停查看高亮，点击采集，Escape 退出。预览包含元素文字、选择器、HTML 摘要、计算样式和可获取的截图。只有页面自身提供开发源码信息时才显示源码位置，不会猜测文件路径。

预览可复制文字或截图，也可选择一个正在运行的 NAND Agent 并附加。材料以本机文件及文字进入 Agent 输入区，**不会自动发送**；请检查后按 Enter。Agent 输入区尚未就绪时会提示稍后重试。网页材料是参考内容，不代表对 Agent 的新指令。

更多菜单的“截图标注”提供画笔、高亮、箭头、矩形、椭圆、文字、撤销和重做。元素截图也可进入标注，完成后可复制并附加。Agent 修改项目源码；支持热更新的网站会自行更新，否则刷新网页验证。

## 支持范围

面向桌面版 Obsidian 的 HTTP(S) 网站和本地服务。部分登录服务可能拒绝嵌入式浏览器，DRM、浏览器扩展依赖等能力也可能受限，此时使用系统浏览器。超大网页会明确拒绝整页截图，可改用可见区域截图。没有多账户配置、外部 Cookie 导入、SSH 网络转发、远程浏览器或 MCP 服务。

实际验证平台及未完成项见[当前基线](../speculo/.speculo/specdev/archive/2026-10/2026-10-01-current-baseline/README.md)。中文自动填写不等同于操作系统输入法候选窗口验收。

浏览交互与部分算法参考 [Orca](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b)，保留其 [MIT 许可](third-party/orca-LICENSE.txt)。

## 权限与恢复

站点敏感权限默认拒绝。工具栏的盾牌菜单按站点授权摄像头／麦克风、位置、通知、剪贴板读取等权限；登录弹窗使用同一分区与策略。跨来源请求不会继承主页面授权。

导航默认最多等待 30 秒。关闭或取消立即结束调用方等待；无法安全继续的页面会释放原生 guest。点击重试或输入新地址可重新创建页面，旧操作不会写回新页面。
