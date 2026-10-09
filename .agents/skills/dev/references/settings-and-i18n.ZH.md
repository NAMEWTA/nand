[English](settings-and-i18n.md) | 简体中文

# 设置与文案

## 设置存储

`SettingsStore`（`src/shared/settings/store.ts`）保存带名字的命名空间，每个命名空间有自己的模式。`src/app/settings/runtime.ts` 在两个文件之上创建它：

| 范围 | 文件 | 用途 |
|---|---|---|
| `vault` | `.nand/config/settings.json` | 所有设备共用的偏好 |
| `device` | `.nand/config/devices/<device-id>.json` | 每台机器自己的值：智能体 Shell 与路径、音乐音量、面板尺寸 |

两个文件都是 `{ version: 1, namespaces: { <name>: {…} } }`。形状不同的文件会被忽略，使用默认值。还没有代码绑定的命名空间保留它存储的值，并原样写回。`app` 命名空间（`src/app/settings/app-schema.ts`：语言、介绍、状态栏、模块开关）、`theme` 以及应用在启动时需要的命名空间（`home`、`archives`、`browser`、`comments`）在 `runtime.ts` 里绑定；其他模块绑定自己的。未知键在规范化时被丢弃。库里第一次加载时写入默认值（`firstRun`）。

`app.modules` 里的每个模块开关都从该模块清单的 `defaultEnabled` 开始。

## 定义模式

```ts
import { defineSettings, f } from '../../shared/settings/schema';

export const fooSettings = defineSettings({
	enabled: f.boolean({ default: true }),
	limit: f.number({ default: 20, min: 1, max: 500, integer: true }),
	mode: f.enum(['list', 'card'] as const, { default: 'list' }),
	shell: f.string({ default: '', scope: 'device' }),
	tags: f.list(f.string({ default: '' }), { default: [], max: 50 }),
	window: f.object({ width: f.number({ default: 320, min: 200 }) }),
});
```

每个字段都有默认值、从不抛错的规范化函数和范围（不写则为 `vault`）。已经有自己的模型和规范化函数的领域用 `domainSettings({ defaults, normalize, scope })`（见 `src/modules/browser/settings.ts`、`src/modules/agent/settings.ts`），单个字段用 `f.custom`。

## 使用句柄

```ts
const settings = context.settings.bind('foo', fooSettings);
settings.get().limit;                                   // 读取（视为只读）
await settings.update((draft) => { draft.limit = 50; }); // 修改；订阅者同步执行
settings.select((value) => value.mode, (next) => redraw(next));
context.lifetime.register(settings.subscribe(refresh));
```

- `update` 先在内存中提交并通知，然后防抖写入（250 毫秒，距第一个待写入的修改最多 1 秒），或用 `{ persist: 'immediate' }` 立即写入；写入完成后 Promise 才结算。写入被拒绝时要报告；不要先显示成功。
- 文本输入：在 change 时更新，而不是在每次按键都触发重活；存储会合并写入，但重绘由你负责。
- `touch()` 用来保存原地修改，为首页模块的看板代码而存在；新代码使用 `update`。
- 密钥（API key、令牌）不应放进库级设置；放在设备范围里，或根本不放进库，并在界面上说明。

## 文案

`t(key, params?)`（`src/shared/i18n`）先在当前语言里查键，再查英文，最后返回键本身。参数替换 `{name}`。

| 词典 | 内容 | 注册方式 |
|---|---|---|
| `src/shared/i18n/*.ts`（启动） | 启动代码读取的键：应用、工作台外壳、设置入口页、图标轨标签、启动时注册的命令、模块标题 | 在 `src/shared/i18n/runtime.ts` 里合并 |
| `src/shared/i18n/lazy/*.ts` | 多个模块读取、启动代码不读取的键 | 由使用它们的每个模块在 `module.ts` 里注册 |
| `src/modules/<id>/i18n.ts` | 只有该模块读取的键 | 由它的 `module.ts` 注册 |

添加文案：

1. 把键放进读取它的代码所在的词典，`en` 和 `zh` 一起写。键用点分隔，按领域加命名空间（`agent.`、`browser.`、`workbench.`……）。
2. 如果启动代码读取的键放在模块词典里，把它移到启动词典（否则模块加载前启动代码会显示键本身）。
3. 运行 `pnpm test:i18n`：它检查每个词典都有两种语言、`{占位符}` 一致，并且每个字面量 `t('…')` 的键在某处存在。
4. 测试和验证脚本通过 `scripts/module-strings.ts` 注册模块词典和懒加载词典；新词典要加到那里。

## 语言

语言偏好是 `app.language`（`zh` 或 `en`）。新库跟随 Obsidian 的语言（中文 → `zh`，否则 `en`）。切换语言先保存，再调用 `setLanguage`；保存失败则保持原语言。显示文案的组件用 `onLanguageChanged` 订阅并重绘，不丢失草稿；只创建一次的原生标签使用 `src/ui/primitives/localized-dom.ts` 和 `localized-form.ts` 里的绑定。用户内容、路径、标识符、提示词和 CLI 输出从不翻译。

英文界面文字用句首大写。命令名称来自 `nameKey`，因此跟随语言。
