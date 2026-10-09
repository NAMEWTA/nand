[English](testing.md) | 简体中文

# 测试

汇报时写明你运行了哪些测试。构建通过不能验证界面；只有真实 Obsidian 探针可以。

## 分层

| 层 | 位置 | 运行 |
|---|---|---|
| 单元与 DOM 测试 | 就近的 `src/**/*.test.ts(x)`、`test/**/*.test.ts` | `pnpm test`（vitest，`vitest.config.ts`） |
| 用户格式黄金样本 | `test/golden/user-formats.test.ts` + `__snapshots__/` | 属于 `pnpm test` |
| 验证脚本 | `scripts/verify-*.ts`，在 `package.json` 里接成 `test:<name>` | `pnpm run test:<name>` |
| 门禁脚本 | 架构、i18n、文档、样式、Promise 回调、工作台入口、构建文本 | `pnpm test:architecture`、`test:i18n`、`test:docs`、`test:styles` 等 |
| 以上全部 | 除自身外的每个 `test:*` 脚本 | `pnpm run test:all` |
| Rust 辅助程序 | `native/pty-server/tests`、单元测试 | `pnpm run check:native`（`cargo test --locked`） |
| 真实 Obsidian | `scripts/obsidian-acceptance/`（针对一次性库的 CDP） | 见下文 |

## Vitest

两个项目：`unit`（Obsidian 别名到 `scripts/obsidian-stub.ts`，node 环境）和 `settings-iconic`（`vitest.config.ts` 里列出的两个测试，别名到 `scripts/iconic-obsidian-stub.ts`）。初始化文件 `scripts/module-strings.ts` 注册模块词典和懒加载词典，所以组件渲染的是真实文案。`.svg` 和 `.md` 导入与打包一样按文本加载。

新测试是就近的 `*.test.ts` 文件，从 `vitest` 导入 `test`/`vi`，而不是新增验证脚本。测试在 `pnpm run build` 期间由 `tsconfig.test.json` 做类型检查。测试依赖的时区或时钟要固定（`vi.useFakeTimers({ now, toFake: ['Date'] })`）。

## 黄金样本

`test/golden/user-formats.test.ts` 通过生产代码写出看板、档案、自动化定义，以及习惯、记账、阅读和番茄钟文档，把字节与 `__snapshots__/` 比较，再读回来。重构必须保持快照不变。如果任务就是修改格式，用 `pnpm vitest run test/golden -u` 更新并检查差异。评论旁路文件由评论测试锁定，`iconic.json` 由 Iconic 移植测试锁定。

`.gitattributes` 让黄金样本在所有平台都保持 LF，避免检出设置改变断言所比较的字节。

## 改了什么就跑什么测试

| 你修改了 | 运行 |
|---|---|
| 模块生命周期、注册表、命令、设置存储、语言 | `pnpm test`（注册表、设置和语言测试）和 `pnpm test:i18n` |
| 导入、移动文件、启动代码 | `pnpm test:architecture`、`pnpm run check:bundle` |
| 一条文案 | `pnpm test:i18n` |
| CSS | `pnpm run lint:css`、`pnpm test:styles`（先 `node scripts/build-styles.mjs --write`） |
| 评论 | `pnpm test`（`src/modules/comments/comments.test.ts`，它导入 `scripts/verify-comment-*.ts`） |
| 看板解析、小组件、记录 | `pnpm test`，加上名称与功能匹配的看板 `test:*` 脚本 |
| 自动化、通知 | `pnpm test`（自动化与通知测试套件）、`pnpm run test:safety-regressions` |
| 档案 | `pnpm test`（`src/modules/archives/archives.test.ts`）；规模：`pnpm run accept:contacts-scale` |
| 图标 | `pnpm test`（`src/modules/icons/iconic-port.test.ts` 里的 Iconic 对照） |
| Git 同步 | `pnpm test`（`src/modules/sync`、`test/sync/git-flow.test.ts`，后者针对临时远端运行系统 Git） |
| 终端模型、键盘、呈现 | `pnpm test`（`src/modules/agent/**`）；Rust 辅助程序：`pnpm run check:native` 和 `node scripts/verify-pty-helper.mjs <二进制>` |
| 升版本、发版文件 | `pnpm test`（`test/release/release-artifacts.test.ts`）和 `node scripts/verify-release-artifacts.mjs <version>` |
| 文档或技能 | `pnpm test:docs` |
| 工作台、页面、设置界面、终端界面、浏览器 | 真实 Obsidian 探针 |

## 真实 Obsidian 探针

`scripts/obsidian-acceptance/workbench-fresh-runtime.mjs` 创建一次性的库和配置目录，用远程调试启动 Obsidian，安装构建好的插件并运行 `workbench-probe.mjs`，然后重启 Obsidian，再用 `--verify-restart` 运行一次。探针覆盖多种宽度下的工作台布局、图标轨上的每个页面、设置页、模块开关、档案编辑、评论、浏览器标签、专注模式、记录页、通过真实 `nand-pty` 的终端、Git 同步，以及重启后的路由恢复。证据（JSON 和截图）写入 `<root>/evidence/`。

```sh
pnpm run build
cargo build --release --manifest-path native/pty-server/Cargo.toml
NAND_PTY_BINARY=$PWD/native/pty-server/target/release/nand-pty \
NAND_ALLOW_FRESH_ISSUE_FIXTURE=1 NAND_FRESH_FIXTURE_ROOT=/tmp/nand-probe-<name> \
NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian \
xvfb-run -a -s "-screen 0 1600x1100x24" node scripts/obsidian-acceptance/workbench-fresh-runtime.mjs
```

每次运行都用新的根目录，它必须尚不存在。`NAND_PTY_BINARY` 让插件使用本地辅助程序，而不下载 Release 附件。`theme-matrix.mjs` 为主题样式在阅读、实时预览和源码模式下截图。你引用的证据要自己保留；临时目录会被清理。

CI 没有 Obsidian 运行环境；Windows 和 macOS 上的终端行为（ConPTY、输入法、CLI 智能体）在真实机器上检查，已验证和未验证的内容记录在 `speculo/.speculo/specdev/context/validation.md`。
