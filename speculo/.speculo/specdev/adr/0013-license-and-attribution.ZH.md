[English](0013-license-and-attribution.md) | 简体中文

# ADR-0013：MIT 许可与第三方署名

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

NAND 改编了其他项目的设计和代码，把 npm 包打包进 `main.js`，并把 Rust crate 链接进终端辅助进程。要以一种宽松许可证分发，所有随发布提供的内容都必须与之兼容，每个来源也必须在许可证要求的地方署名。这是工程实践，不构成法律意见。

## 决定

- **NAND 使用 MIT。** `LICENSE` 保存许可文本。随 `main.js`、`styles.css` 或辅助进程发布的所有内容，都必须与 MIT 分发兼容。
- **署名放在哪里。**
  - `NOTICE` 列出 NAND 改编的作品及其许可文本：apex-dashboard 与 obsidian-dashboard（MIT，看板设计）、Orca（MIT，含固定的提交映射）、Iconic（MIT-0，含其资源许可）、obsidian-git（MIT，Git 同步的行为），以及终端及其辅助进程是为 NAND 编写的声明。
  - `THIRD-PARTY-NOTICES.md` 由 `scripts/third-party-notices.mjs` 生成。它列出打包进 `main.js` 的每个 npm 包和链接进 `nand-pty` 的每个 crate，并附许可文本。生成器拒绝未知许可证和 GPL 许可证，文件与打包内容和 crate 依赖图不一致时 `pnpm run check:notices` 失败。
  - `src/modules/icons/core/res/NOTICE.txt` 为图标资源和 Unicode 数据署名。
  - `docs/third-party/` 记录从 Orca 改编的内容，并保存其许可文本。
  - `main.js` 开头的横幅嵌入 `LICENSE`、`NOTICE`、图标资源声明、Orca 许可和打包依赖的许可。发布附件包含 `LICENSE`、`NOTICE` 和 `THIRD-PARTY-NOTICES.md`。
- **依赖。** 接受 MIT、ISC、BSD、Apache-2.0、MIT-0、CC0、Unicode 和 Zlib。不接受 GPL、AGPL、用于打包代码的 LGPL、SSPL 以及无许可证的代码。新增依赖尽可能懒加载，并在之后重新生成 `THIRD-PARTY-NOTICES.md`；Rust 构建使用 `--locked`。
- **改编的代码。** 来自 MIT、ISC 或 BSD 项目的代码，在文件头注释写明来源和上游提交、`NOTICE` 中有带上游自己版权行的条目、并记录文件映射时，可以改编。对 GPL 项目只研究其公开行为和用户可见的概念；编写 NAND 代码时不打开它们的源码，也不转述。
- **终端。** 终端（`src/modules/agent`）和 `native/pty-server` 不含 GPL 代码。它们依据公开的行为和文档构建：Orca（MIT）、xterm.js 及其附加组件、`portable-pty`，以及公开的协议规范（xterm 控制序列、kitty 键盘协议、win32-input-mode、ConPTY、VS Code shell 集成序列、OSC 7）。
- **相似度门槛。** `scripts/check-similarity.mjs` 比较 NAND 代码树与参考代码树的 token k-gram，只输出路径和数字。与某个参考文件的原始份额达到 0.15，或有超过 40 个 token 的原始连续匹配的文件，需要调查；规范化后最高的匹配由人工复核。大型终端改动之后和发布之前运行，参考代码树放在仓库之外。

## 影响

新增依赖或改编代码有固定的检查清单，署名文件在能够机械检查的地方都会被检查。相似度检查需要不在仓库里的参考代码树。

## 依据

[LICENSE](../../../../LICENSE)、[NOTICE](../../../../NOTICE)、[署名生成器](../../../../scripts/third-party-notices.mjs)、[esbuild 横幅](../../../../scripts/esbuild-options.mjs)、[相似度工具](../../../../scripts/check-similarity.mjs)、[Orca 改编说明](../../../../docs/third-party/orca-terminal-workbench.md)。`pnpm run check:notices`。
