# 构建与发版

本文的 React/Tailwind 构建规则对应 [实施文档阶段 2](../../../../docs/refor/10-实施文档.md) 的目标；阶段 0 只改规则，相关脚本和命令随阶段 2 落地。实际可执行入口以 `package.json` 为准，CI/发行授权不变。

## 脚本

| 脚本 | 作用 |
|---|---|
| `dev` | esbuild 与 Tailwind 监听，重新生成作用域样式并拼接；开发 JS 内联 sourcemap、不压缩 |
| `build` | 源码/测试类型检查、Tailwind 编译与作用域处理、样式拼接、esbuild 生产构建 → `main.js` 与 `styles.css` |
| `build:css` | `node scripts/build-tailwind.mjs --write-styles`，生成 Tailwind/字体并拼接 `styles.css` |
| `lint` | ESLint，`--max-warnings 0` |
| `lint:css` | 用 stylelint 检查 `src/**/*.css`，文件级基线只减不增（`scripts/stylelint-baseline.json`）；新违规会失败 |
| `check:bundle` | 从 esbuild 元数据得到启动集合和各模块的激活闭包，与 `scripts/bundle-budget.json` 比较；超预算失败（`--files` 列出启动输入） |
| `check:styles` | 报告体积、`!important`、字面量颜色、z-index 和重复选择器 |
| `check:native` | 对 `native/pty-server` 运行 `cargo test --locked` |
| `check:notices` | `THIRD-PARTY-NOTICES.md` 与打包内容和 crate 依赖图一致（`pnpm run notices` 会重写它） |
| `check:similarity` | 对照参考项目计算源码树的 k-gram 相似度（见 `licensing.md`） |
| `format`、`format:check` | 用 prettier 处理 `src/**/*.{ts,tsx}` 和 `scripts/**/*.ts`；不属于 CI |
| `test`、`test:*`、`test:all` | 见 `testing.md` |

`main.js` 和 `styles.css` 是受版本管理的产物。按 `testing.md` 在构建输入变化时重建并留在工作区；用户授权提交后与源码一起提交。CI 会检查产物与源码是否一致。

## 样式

组件的 Tailwind 类也是样式输入；必要的作者 CSS 放在所属方（`src/ui`、`src/theme`、`src/shell`、`src/app`、`src/modules/<id>`），保持 `src/styles.json` 的明确顺序。阶段 2 后运行 `pnpm run build:css`（先编译 Tailwind，再由 PostCSS 展开层并加作用域，最后拼接），不能只重跑旧拼接器。`src/styles.json` 里的顺序就是层叠顺序，不要按文件名排序。CSS 不能懒加载（Obsidian 只允许一个样式表），所以模块 CSS 限定在模块自己的类名下，或限定在模块激活期间添加的 body 类名下。

清单前部依次是 `fonts.generated.css`、`tokens.css`、`base.css`、`neutralize.css`、`build/tailwind.scoped.css`，然后是其余作者文件。`build/` 不提交，`test:styles` 必须先生成 Tailwind 再执行 `build-styles.mjs --check`，支持新克隆。字体二进制、字体许可与生成的 `src/ui/styles/fonts.generated.css` 随仓库保存；生成 Tailwind 和字体 CSS 不参与作者 stylelint。

样式构建器把每个源文件（包括依赖包的样式表）的 CRLF 统一为 LF。`--write` 输出 LF；`--check` 也会归一化检出的 `styles.css`，因此 Windows 的检出设置不会影响结果。生成的 `styles.css` 和 `THIRD-PARTY-NOTICES.md` 由 `.gitattributes` 固定为 LF 检出，保证各平台的包体预算、许可校验与发行字节一致。

## esbuild

`esbuild.config.mjs` 使用 `scripts/esbuild-options.mjs`（与 `check:bundle` 和 `notices` 共用）：单一入口（`src/app/main.ts`）、CommonJS、ES2021、生产构建压缩、`.md`/`.svg` 作为文本、`jsxImportSource: react`，不设置兼容运行时别名。外部依赖：`obsidian`、`electron`、`@codemirror/*`、`@lezer/*`、Node 内置模块。横幅内嵌 `LICENSE`、`NOTICE`、图标资源声明、Orca 许可证和打包依赖的许可证。不要增加第二个入口，也不要打包 CodeMirror。保持浏览器平台的 `process.env.NODE_ENV` 构建替换，不改为 `platform: node`；React 界面约定见 [ui 技能](../../ui/SKILL.md)。

## 预算

`scripts/bundle-budget.json`：

- `eagerBytes`：插件加载时运行的内容，数值以预算文件为准。
- `moduleActivationBytes`：每个模块开启时执行的内容（不含页面、设置页和第二层 `import()`）。
- `forbiddenEagerAreas`：绝不能进入启动集合的库，包含 `npm:react-dom`、`npm:radix-ui`；React 渲染按需加载。
- `outputBytes`、`stylesBytes`：`main.js` 和 `styles.css` 总大小的上限。代码变小时调低；重构依赖增量在相应 `*Reason` 字段记录理由，迁移结束后收紧预算，不为过检查无理由调高。

## CI

`.github/workflows/lint.yml` 可被 workflow_call 复用；Linux Node22/24 与 Windows Node24 使用同一完整检查集合：安装、构建、main.js/styles.css 差异、包体、lint/CSS、test:all、许可和Rust。Release 同时依赖同一 SHA 的完整 checks 与五平台 helper，只有两者 success 才发布；失败、取消、跳过均阻止发布。helper继续由CI构建，各平台执行真实 stdio 验证。

pnpm 版本固定在 `package.json`；CI 使用 `pnpm install --frozen-lockfile`。

## 升版本

在同一次提交里一起修改，否则不要发版：

| 文件 | 修改 |
|---|---|
| `manifest.json` 的 `version` | 新版本号，不带 `v` 前缀 |
| `package.json` 的 `version` | 相同 |
| `versions.json` | `"<version>": "<minAppVersion>"` |
| `CHANGELOG.md` | 有一个 `## <version>` 小节，且没有「未发布」小节 |
| `main.js` | 用该提交重建 |

`scripts/verify-release-artifacts.mjs <version>` 把前四项与标签核对，`CHANGELOG.md` 里有 `## Unreleased` 小节时失败。提高 `minAppVersion` 会让部分用户无法升级；只有在有记录的理由时才这样做。

当前版本以 `manifest.json`、`package.json` 和 `versions.json` 为准。标签中 `-` 之后带后缀的版本会成为 GitHub 预发布，不会标为最新版。

## 发版

推送 `main`，再推送标签（`git tag <version> && git push origin <version>`）。`.github/workflows/release.yml` 是唯一创建 Release 的地方：

1. 先通过同一 SHA 的完整质量检查，再为五个目标构建辅助程序（`terminal-build.yml`）。
2. 把标签与 `manifest.json`、`package.json`、`versions.json`、`CHANGELOG.md` 核对，构建，并在构建出的 `main.js` 或 `styles.css` 与提交的不同时失败。
3. 收集 `main.js`、`manifest.json`、`styles.css` 和 `nand-<version>.zip`，用 `scripts/verify-release-artifacts.mjs --plugin` 检查，并为 zip、`main.js` 和 `styles.css` 生成来源证明。
4. 用各自的 `.sha256` 文件核对五个 `nand-pty-<平台>-<架构>[.exe]` 二进制，并用 `scripts/verify-pty-helper.mjs` 运行 Linux 版本。
5. 为所有附件写入 `SHA256SUMS.txt`，并创建带插件文件、zip、辅助程序、校验和、`LICENSE`、`NOTICE` 和 `THIRD-PARTY-NOTICES.md` 的 GitHub Release。

Obsidian 从 Release 安装 `main.js`、`manifest.json` 和 `styles.css`。第一次使用终端时，插件从自己版本的 Release 下载当前平台的辅助程序，校验正式 SHA-256 并保存在当前 vault 的 `.nand/helpers/<device-id>/<platform-arch>/<version>/`（开发 override 只复制到库内执行）。永远不要提交辅助程序的二进制文件。
