[English](build-and-release.md) | 简体中文

# 构建与发版

## 脚本

| 脚本 | 作用 |
|---|---|
| `dev` | esbuild 监听模式，内联 sourcemap，不压缩 |
| `build` | `tsc`（源码）、`tsc -p tsconfig.test.json`（测试）、`build-styles.mjs --check`、esbuild 生产构建 → 仓库根目录的 `main.js` |
| `lint` | ESLint，`--max-warnings 0` |
| `lint:css` | 用 stylelint 检查 `src/**/*.css`，文件级基线只减不增（`scripts/stylelint-baseline.json`）；新违规会失败 |
| `check:bundle` | 从 esbuild 元数据得到启动集合和各模块的激活闭包，与 `scripts/bundle-budget.json` 比较；超预算失败（`--files` 列出启动输入） |
| `check:styles` | 报告体积、`!important`、字面量颜色、z-index 和重复选择器 |
| `check:native` | 对 `native/pty-server` 运行 `cargo test --locked` |
| `check:notices` | `THIRD-PARTY-NOTICES.md` 与打包内容和 crate 依赖图一致（`pnpm run notices` 会重写它） |
| `check:similarity` | 对照参考项目计算源码树的 k-gram 相似度（见 `licensing.ZH.md`） |
| `format`、`format:check` | 用 prettier 处理 `src/**/*.{ts,tsx}` 和 `scripts/**/*.ts`；不属于 CI |
| `test`、`test:*`、`test:all` | 见 `testing.ZH.md` |

`main.js` 和 `styles.css` 提交到仓库。重建后与源码一起提交；重建的 `main.js` 与提交的不同时 CI 会失败。

## 样式

在所属方的 `styles/` 文件夹里编辑作者文件（`src/ui`、`src/theme`、`src/shell`、`src/app`、`src/modules/<id>`），保持它在 `src/styles.json` 中的位置，然后运行 `node scripts/build-styles.mjs --write`。`src/styles.json` 里的顺序就是层叠顺序，不要按文件名排序。CSS 不能懒加载（Obsidian 只允许一个样式表），所以模块 CSS 限定在模块自己的类名下，或限定在模块激活期间添加的 body 类名下。

样式构建器把每个源文件（包括依赖包的样式表）的 CRLF 统一为 LF。`--write` 输出 LF；`--check` 也会归一化检出的 `styles.css`，因此 Windows 的检出设置不会影响结果。

## esbuild

`esbuild.config.mjs` 使用 `scripts/esbuild-options.mjs`（与 `check:bundle` 和 `notices` 共用）：单一入口（`src/app/main.ts`）、CommonJS、ES2021、生产构建压缩、`.md`/`.svg` 作为文本、把 `react` 别名到 Preact。外部依赖：`obsidian`、`electron`、`@codemirror/*`、`@lezer/*`、Node 内置模块。横幅内嵌 `LICENSE`、`NOTICE`、图标资源声明、Orca 许可证和打包依赖的许可证。不要增加第二个入口，也不要打包 CodeMirror。

## 预算

`scripts/bundle-budget.json`：

- `eagerBytes`：插件加载时运行的内容（120 KiB）。
- `moduleActivationBytes`：每个模块开启时执行的内容（不含页面、设置页和第二层 `import()`）。
- `forbiddenEagerAreas`：绝不能进入启动集合的库。
- `outputBytes`、`stylesBytes`：`main.js` 和 `styles.css` 总大小的上限。代码变小时调低；没有记录原因不要调高。

## CI

`.github/workflows/lint.yml` 在每次推送和 PR 时运行：Linux（Node 22 和 24）执行安装、构建、`check:bundle`、`git diff --exit-code -- main.js`、lint、`lint:css`、`test:all`、`check:notices`、`check:native`；Windows（Node 24）执行构建、`main.js` 差异检查、lint、`lint:css` 和 `test:all`。`.github/workflows/terminal-build.yml` 为 linux-x64、linux-arm64、darwin-x64、darwin-arm64 和 win32-x64 构建并测试辅助程序，并在每个平台运行 `scripts/verify-pty-helper.mjs`。

pnpm 版本固定在 `package.json`；CI 使用 `pnpm install --frozen-lockfile`。

## 升版本

在同一次提交里一起修改，否则不要发版：

| 文件 | 修改 |
|---|---|
| `manifest.json` 的 `version` | 新版本号，不带 `v` 前缀 |
| `package.json` 的 `version` | 相同 |
| `versions.json` | `"<version>": "<minAppVersion>"` |
| `CHANGELOG.md`、`CHANGELOG.ZH.md` | 各有一个 `## <version>` 小节，且没有「未发布」小节 |
| `main.js` | 用该提交重建 |

`scripts/verify-release-artifacts.mjs <version>` 把前四项与标签核对，`CHANGELOG.md` 里有 `## Unreleased` 小节时失败。提高 `minAppVersion` 会让部分用户无法升级；只有在有记录的理由时才这样做。

当前版本是 `0.0.1-alpha.1`，是预发布版。标签中 `-` 之后带后缀的版本会成为 GitHub 预发布，不会标为最新版。

## 发版

推送 `main`，再推送标签（`git tag <version> && git push origin <version>`）。`.github/workflows/release.yml` 是唯一创建 Release 的地方：

1. 为五个目标构建辅助程序（`terminal-build.yml`）。
2. 把标签与 `manifest.json`、`package.json`、`versions.json`、`CHANGELOG.md` 核对，构建，并在构建出的 `main.js` 或 `styles.css` 与提交的不同时失败。
3. 收集 `main.js`、`manifest.json`、`styles.css` 和 `nand-<version>.zip`，用 `scripts/verify-release-artifacts.mjs --plugin` 检查，并为 zip、`main.js` 和 `styles.css` 生成来源证明。
4. 用各自的 `.sha256` 文件核对五个 `nand-pty-<平台>-<架构>[.exe]` 二进制，并用 `scripts/verify-pty-helper.mjs` 运行 Linux 版本。
5. 为所有附件写入 `SHA256SUMS.txt`，并创建带插件文件、zip、辅助程序、校验和、`LICENSE`、`NOTICE` 和 `THIRD-PARTY-NOTICES.md` 的 GitHub Release。

Obsidian 从 Release 安装 `main.js`、`manifest.json` 和 `styles.css`。第一次使用终端时，插件从自己版本的 Release 下载当前平台的辅助程序，校验 SHA-256 并保存在插件目录（开发时可用 `NAND_PTY_BINARY` 覆盖）。永远不要提交辅助程序的二进制文件。
