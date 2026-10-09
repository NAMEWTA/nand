# Obsidian API 规则（本仓库的用法）

改编自 SKILL.md `metadata.adapted-from` 所列的技能，以及本仓库在 `eslint.config.mts` 里启用的 `eslint-plugin-obsidianmd` 的 `recommended` 规则。

生产代码 `src/**/*.ts(x)` 用 `--max-warnings 0` 检查：警告和错误一样会失败。`scripts/**`、测试和配置文件被忽略（`eslint.config.mts`）。该文件里的局部例外都写明了理由（TypeScript 文件关闭核心规则 `no-undef`；`desktop/` 文件夹可以使用 Node）。

`minAppVersion` 是 1.13.0（见 SKILL.md 的身份表），所以 Obsidian 设置页只用声明式的 `getSettingDefinitions()`，没有 `display()` 后备。

## 内存与生命周期

| 应该 | 不应该 |
|---|---|
| `this.registerEvent(app.vault.on / workspace.on / …)` | 订阅后不管，或在 `registerEvent` 能做到时只在 `onunload` 里 `off()` |
| 在插件或所属 `Component` 上用 `registerDomEvent` | 现在 `addEventListener`，之后在 `activeDocument` 上 `removeEventListener`——焦点可能已经移动，会从另一个文档上移除 |
| 周期性工作用 `registerInterval` | 插件卸载后仍然存活的裸计时器 |
| 在 `registerView` 工厂里返回视图 | 把 `ItemView` 实例存在插件上或模块全局变量里；需要时遍历叶子 |
| 让 Obsidian 分离叶子 | 在 `onunload` 里调用 `detachLeavesOfType()` |

`activeDocument` 和 `activeWindow` 跟随焦点。设置和清理必须作用于同一个文档时，把文档保存在局部变量里。

长期运行的服务属于模块，随模块结束（见 `module-authoring.md`）。视图和页面不是服务。

在组件之外创建 DOM 的浮层和对话框，必须在 `destroy` / `onClose` 里移除这些 DOM。评论浮层被追加到 `view.dom.ownerDocument.body`，并在 CodeMirror 插件的 `destroy()` 里移除。

## 类型

```ts
// 文件和文件夹——用 instanceof，不要强制转换
const file = app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
  // ...
}

// DOM 节点和界面事件——用 instanceOf，因为弹出窗口属于另一个 realm
if (node.instanceOf(Text)) {
  // ...
}
```

跨窗口的 `instanceof HTMLElement` 正是 `.instanceOf` 要防止的缺陷。`TFile` / `TFolder` 仍用 `instanceof`（与应用在同一个 realm）。

不用 `any`，不用 `var`。评论存储里使用的模式是 `unknown` 加一个收窄函数（`asRecord`）。未公开的 `app.commands` 在 `src/host/obsidian/obsidian-internal.ts` 里有类型。使用那个接口。

## 文件

| 情形 | API |
|---|---|
| 编辑用户正在输入的笔记 | 编辑器 API（`editor.replaceSelection`、CodeMirror）。不要用 `Vault.modify` |
| 在后台编辑笔记 | `Vault.process` |
| 删除 | `FileManager.trashFile` |
| 查找路径 | `Vault.getAbstractFileByPath` 或 `getFileByPath`。不要用 `getFiles().find` |
| 库内相对路径 | `normalizePath` |
| 桌面文件系统路径 | 原生 `path.resolve` / `path.join`；保留绝对根、UNC 前缀、空格和字面量 `%20` |
| 网络 | `requestUrl`。不要用 `fetch` |
| 系统／设备形态 | `Platform.isPhone`、`Platform.isDesktopApp`、`Platform.isDesktop`。不要用 `navigator.userAgent` |
| 语言 | 插件自己的 i18n。不要读取 `localStorage.language` |

插件目录路径使用 `manifest.id`。必须保持不变的持久化名称见 `architecture.md` 的数据表。

这里不允许正则后行断言（iOS < 16.4）。插件不是仅桌面版（见 SKILL.md 身份表的 `isDesktopOnly`）。

## 界面文字、命令、设置

- 英文界面和 `t()` 的值用句首大写。专有名词保持大写。文案放在哪里见 `settings-and-i18n.md`。
- 命令 id 与名称遵循 `architecture.md` 的「命令」一节。用 `addCommand` 注册，在模块内部用 `context.commands.add`。
- 设置标题用 `Setting.setHeading()`，不要手写 `<h2>`，也不要命名为「General」「Settings」或显示名称。
- 设置放进设置存储的命名空间（见 `settings-and-i18n.md`）；绝不用 `saveData`。评论、图标这类领域存储拥有自己记录在案的文件。
- 新设置放在所属模块的工作台设置页（或「常规」／「外观」）。Obsidian 的设置页（`src/app/settings/entry-tab.ts`，只用声明式的 `getSettingDefinitions()`）只放入口行：打开工作台设置、语言、状态、主题样式、模块开关。
- 用设置页自己的 `refresh()` 重绘 Obsidian 设置页；用 `host.refresh()` 重绘工作台设置页。不要调用 `display()`。
- 在设置回调里，`activeDocument` 是设置窗口。要操作主工作区，用 `this.app.workspace.containerEl.ownerDocument`。

## DOM 与 CSS

- 在父 `HTMLElement` 上用 `createEl` / `createDiv` / `createSpan` / `createSvg` 构建界面。不要用 `document.createElement`。
- 样式放在 SKILL.md 身份表所列的唯一样式表里。不要注入 `<style>` 或 `<link>`。能用类名时不要在 TypeScript 里赋大段样式。坐标（评论浮层的 `left` / `top`）是例外。
- 使用 NAND 令牌和 Obsidian 变量；颜色只存在于 `src/theme/` 和令牌层（`../../ui/references/design-system.md`）。`pnpm run lint:css` 会拒绝基线之外的字面量颜色、`!important`、`:has`、原始 z-index 值和重复选择器。
- 选择器限定在模块的类名下（`.nand-editor-…`、`.nand-contacts-…`、`.dashboard-…`）。不写裸的 `button { }` 规则。给 Obsidian 自身 DOM 设样式的规则挂在模块激活期间添加的 body 类名下。
- 直接编辑模块 `styles/` 文件夹下的作者文件，不要在别处追加覆盖。
- 用 TypeScript 切换类名，而不是去用 `!important` 或 `:has`。
- 只有图标的按钮需要可访问名称（`aria-label` 或 `setTooltip`）。触屏上的可交互目标至少 44×44px。不要去掉 `:focus-visible` 轮廓。
- 键盘：不是原生 `button` 的可点击控件，也必须支持 Enter / Space。

## 计时器与 Promise

`eslint-plugin-obsidianmd` 要求用 `window.setTimeout` / `window.clearTimeout`（更好的是所属元素的 `win`），而不是裸计时器或 `globalThis`。需要计时器的 core 代码把它们作为注入的 `{ set, clear }` 对接收（设置存储、评论存储），这样测试可以传入 Node 计时器，宿主选择窗口。

每个 `Promise` 都要等待、返回，或显式 `void`。`workspace.revealLeaf` 是一个 Promise。

## 日志与平台模块

不要在 `onload` / `onunload` 里 `console.log`；用 `console.error('[NAND <area>]', error)` 报告错误，需要用户处理时再加一个 Notice。

`electron`、Node 内置模块和 `window.require` 只存在于 `desktop/` 文件夹（架构规则），只从清单里 `platforms.mobile: false` 的模块或 `Platform.isDesktopApp` 之后到达，因此手机永远不会执行它们。

## 清单命名

插件 id 不含 `obsidian`，也不以 `plugin` 结尾。显示名称不含 `Obsidian`，也不以 `Plugin` 结尾。描述不写「This plugin」或「Obsidian」，并以标点结尾。保持这样。

## 无障碍底线

与周围界面保持一致。新的按钮和图标按钮可通过键盘到达、有名称，并在 `:focus-visible` 时可见。能用 `button` 时不要发布只能点击的 `div`。

## 发布卫生

- 代码检查零警告（CI 运行 `pnpm run lint`）。
- Release 为 zip、`main.js` 和 `styles.css` 生成来源证明（`actions/attest-build-provenance`）；把这一步留在 `release.yml` 里。

Iconic 移植保留上游的 CSS 声明和 `.iconic-*` 名称以保持行为一致。每个导入的选择器都由 `body.nand-iconic-enabled` 把关（用 `:where` 保持特异性）；关闭模块会在主窗口和浮动窗口里移除这个 body 标记。把它当作有范围的移植例外，不要当作新增全局 CSS 的模板。这次移植用到的 Obsidian 私有成员在 `src/modules/icons/platform/utils/obsidian-internal.ts` 里就地描述；不要添加环境声明或笼统的 lint 抑制。
