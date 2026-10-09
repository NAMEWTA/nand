[English](0003-namespaced-settings-store.md) | 简体中文

# ADR-0003：命名空间设置存储

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

设置属于不同的所有者，作用范围也不同：语言和模块开关由同一个库的所有设备共用，而 shell 路径和 git 位置只属于某一台设备。扁平的字段袋说不清一个值归谁，不能按模块校验，还会在每次按键时写整个文件。

## 决定

- **命名空间与 schema。** 设置按命名空间分组：`app`、`theme`，以及每个有设置的模块一个。每个命名空间有一份用 `defineSettings` 和字段构造器 `f.boolean`、`f.string`、`f.enum`、`f.number`、`f.list`、`f.object`、`f.custom` 构建的 schema。每个字段都有默认值、从不抛错的规范化函数和保存范围。已绑定的命名空间在规范化时丢弃未知键。
- **两种范围，两个文件。** `vault` 字段由所有设备共用，保存在 `.nand/config/settings.json`。`device` 字段属于这台设备，保存在 `.nand/config/devices/<device-id>.json`。两个文件的形状都是 `{ "version": 1, "namespaces": { "<name>": { ... } } }`。其他形状的文件会被忽略，使用默认值。尚未被任何代码绑定的命名空间会原样写回。
- **访问。** 模块用 `context.settings.bind(name, schema)` 绑定自己的命名空间，得到一个句柄：`get`、`update(recipe, { persist })`、`select`、`subscribe` 和 `touch`。`update` 先在内存中提交并同步通知订阅者。持久化按 250 毫秒防抖、最长等待 1 秒，或按要求立即写入。存储释放前会写出待处理的更改。存储对外报告 `idle`、`saving` 或 `error`，每次写入成功后调用 `onPersisted` 监听器。
- **`app` 命名空间。** 保存语言、介绍页标记、工作台状态模式和 `modules` 开关，每个开关默认取自其清单的 `defaultEnabled`。即使所有模块都关闭，它也存在。
- **首次运行。** 两个文件都不存在时写入默认值，语言跟随 Obsidian：Obsidian 为中文时用中文，否则用英文。
- **没有其他通道。** 模块不添加扁平的插件设置，也从不调用 `saveData`。插件目录中不保存设置。

## 影响

每个设置都有所有者、默认值和范围。保存不会在每次按键时执行，写入失败可以通过存储状态看到。home 模块的看板代码会就地修改自己的命名空间，并用 `touch` 持久化；这种用法限定在该模块自己的宿主内（`services/home-host.ts`）。

## 依据

[存储](../../../../src/shared/settings/store.ts)、[schema](../../../../src/shared/settings/schema.ts)、[运行时](../../../../src/app/settings/runtime.ts)、[app schema](../../../../src/app/settings/app-schema.ts)。存储测试（`src/shared/settings/store.test.ts`）和用户数据格式黄金样例测试。
