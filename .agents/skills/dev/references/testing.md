# 测试

本文件是本仓库本地验证的唯一选择表；CI 与发行门禁由 workflow 定义。汇报实际命令、结果和未验证项。构建证明类型与产物可生成，组件/DOM 测试证明相应行为，真实 Obsidian 验收证明宿主集成；三者不互相冒充。

## 选择原则

先确定变更范围、受影响行为和失败风险，再选择最接近它们的检查。普通只读审查不构建产物。影响 JavaScript 产物的 TS/TSX、打包资源或构建配置变化时运行 `pnpm run build` 并保留重建的 `main.js`；生产 TS/TSX 变化时运行 `pnpm run lint`。纯 CSS 仅重建 `styles.css` 并执行 CSS 行的检查，不重建 `main.js`。纯文档、规则或测试脚本修改不因此重建插件，使用文档、脚本或测试自身的检查；测试类型变化可单独运行 `pnpm exec tsc -skipLibCheck -p tsconfig.test.json`。

定向 Vitest 使用 `pnpm exec vitest run <测试文件或目录>`，表中的路径是选择线索。共享基础设施、影响面难以界定或定向检查发现跨域问题时扩大回归；`pnpm test` 是全量 Vitest，`test:all` 是完整脚本集合，不把它们当成每个局部修改的默认命令。

缺陷修复和新行为优先增加能暴露目标问题的回归测试；现有测试已经证明目标时可复用。无行为变化或低影响可逆修改不为形式新增测试。持久化、安全、并发和恢复路径仍需对应行为证据。输入、环境与风险未变化的通过结果可复用；新失败、相关改动或新风险才要求重跑。

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
| 模块生命周期、注册表、命令、设置存储、语言 | 对应注册表、设置或语言测试；词典/语言行为变化加 `pnpm test:i18n`；生命周期变化检查关闭、重开与失败释放 |
| 导入、移动文件、启动代码 | `pnpm test:architecture`、`pnpm run check:bundle` |
| 产品文案 | `pnpm test:i18n`；影响打包输入时按上文重建；仅文字变化不自动要求全量 UI 探针 |
| CSS | `pnpm run lint:css`、`pnpm test:styles`（先 `node scripts/build-styles.mjs --write`） |
| 评论 | `src/modules/comments/comments.test.ts`（导入 `scripts/verify-comment-*.ts`）；锚点/编辑器集成变化补宿主验证 |
| 看板解析、小组件、记录 | 对应单元测试及功能匹配的看板 `test:*`；格式变化加黄金样本 |
| 自动化、通知 | 对应测试套件；执行目标、时间、会话或冲突安全变化加 `pnpm run test:safety-regressions` |
| 档案 | `src/modules/archives/archives.test.ts`；索引、批量处理或性能变化加 `pnpm run accept:contacts-scale` |
| 图标 | `src/modules/icons/iconic-port.test.ts` 中相关 Iconic 对照 |
| Git 同步 | `src/modules/sync` 对应测试；Git 流程变化加 `test/sync/git-flow.test.ts`（临时远端） |
| 终端模型、键盘、呈现 | `src/modules/agent/**` 中对应测试；原生辅助程序变化加 `pnpm run check:native` 和 `node scripts/verify-pty-helper.mjs <二进制>` |
| 升版本、发版文件 | `test/release/release-artifacts.test.ts` 和 `node scripts/verify-release-artifacts.mjs <version>`；实际发布遵守完整发行门禁 |
| 文档或技能 | `pnpm test:docs` 及变更事实/链接核对；触发、权限或流程语义变化验证对应正常、近邻不触发和失败分支 |
| SpecDev 合同 | `node speculo/workflows/specdev/common/tools/validate-specdev.mjs --self-check`；状态工件变化再验证相关 change，不创建无关工件 |
| 构建/校验脚本、测试配置 | 运行所改工具与有意义的正反例；影响插件构建时再运行 build，不以语法检查替代工具行为 |
| 工作台、页面、设置界面、终端界面、浏览器 | 按下节视觉范围与宿主边界选择检查 |

`test:docs` 检查项目文档的结构、链接、部分事实及状态索引，不证明全部文档语义正确；Speculo 工具包不在其严格链接集合内，使用所属包校验器并核对本次修改的引用。

## UI 与宿主验证范围

- 局部视觉修改：检查受影响页面及状态并截图，选择能暴露问题的尺寸和明暗模式；组件测试验证可独立观察的交互。
- 主题令牌、全局样式、shell 或响应式布局：检查受影响的明暗模式、三种主题样式和宽度（≥960、600–960、<600／手机）；只扩展相关维度，避免无差别组合。
- Obsidian API、弹出窗口、编辑器集成、生命周期、终端/浏览器原生边界或重启恢复：在真实 Obsidian 验证受影响场景。局部场景足够时不强制遍历所有模块；全工作台探针用于跨模块集成或广泛回归。

环境不可用时继续可执行的独立检查，报告未验证边界及影响；必需宿主验收未完成时保持待验收，不能用构建成功声明全部通过。可选平台扩展不阻塞已经约定并完成的交付。

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
