[English](licensing.md) | 简体中文

# 许可

NAND 使用 MIT 许可证（`LICENSE`）。保持这一点：发布在 `main.js`、`styles.css` 或辅助程序里的一切，都必须与 MIT 分发兼容并有恰当署名。这是工程实践，不是法律意见。

## 署名放在哪里

| 文件 | 内容 | 维护方式 |
|---|---|---|
| `LICENSE` | NAND 的 MIT 许可证，只有英文 | 手写 |
| `NOTICE` | NAND 改编的作品：apex-dashboard 与 obsidian-dashboard（MIT，看板设计）、Orca（MIT，含提交对应关系）、Iconic（MIT-0）、obsidian-git（MIT，Git 同步）；只有英文 | 手写 |
| `src/modules/icons/core/res/NOTICE.txt` | Lucide（ISC）、源自 Feather 的图标（MIT）、Unicode 数据和其他图标资源 | 手写；随横幅发布 |
| `docs/third-party/orca-terminal-workbench.md`、`.ZH.md`、`orca-LICENSE.txt` | 固定的 Orca 提交和改编内容；Orca 许可证原文 | 手写 |
| `THIRD-PARTY-NOTICES.md` | 打包进 `main.js` 的每个 npm 包和链接进 `nand-pty` 的每个 crate，附许可证原文 | `pnpm run notices`；CI 运行 `check:notices` |
| `main.js` 横幅 | `LICENSE`、`NOTICE`、图标资源声明、Orca 许可证、打包依赖的许可证 | `scripts/esbuild-options.mjs` |

`LICENSE` 和 `NOTICE` 是法律文本，没有 `.ZH` 对应文件。`NOTICE` 和其他进入横幅的文件是纯文本，因为它们被嵌入 `main.js` 顶部的注释里。

Release 附件包含 `LICENSE`、`NOTICE` 和 `THIRD-PARTY-NOTICES.md`。

## 添加依赖

1. 检查许可证。MIT、ISC、BSD、Apache-2.0、MIT-0、CC0、Unicode 和 Zlib 可以用。GPL、AGPL、LGPL（用于打包的代码）、SSPL 和「无许可证」不行；先询问。
2. 尽量从需要它的模块里用懒加载 `import()`；用 `pnpm run check:bundle` 检查。
3. 运行 `pnpm run notices`，提交重新生成的 `THIRD-PARTY-NOTICES.md`（生成器会拒绝未知或 GPL 许可证）。
4. Rust crate 使用 `--locked` 构建，并重新运行 `pnpm run notices`。

## 改编外部代码

- MIT、ISC 或 BSD 项目的代码可以改编：写一段头部注释，注明来源和上游提交（`Adapted from Orca (MIT). Copyright (c) 2026 Lovecast Inc.`），在 `NOTICE` 里添加或更新条目，并在该上游的第三方说明文档（`docs/third-party/`，两种语言）里记录文件对应关系。
- 保留上游的许可证文本。`NOTICE` 和 `docs/third-party/orca-LICENSE.txt` 里的版权行照抄上游，不改写。
- GPL 项目只能用来了解公开行为和用户可见的概念。编写 NAND 代码时不要打开它们的源码，也不要改写它们。

## 终端

终端（`src/modules/agent`、`native/pty-server`）是为 NAND 编写的，不含 GPL 代码。它依据公开的行为和文档构建：

- 允许的参考：Orca（MIT）、xterm.js 及其插件文档、portable-pty 文档、公开的协议规范（xterm 控制序列、kitty 键盘协议、win32-input-mode、ConPTY、VS Code shell integration、OSC 7）。
- 不允许：GPL 许可的终端项目的源码，任何版本都不行。

## 相似度检查

`scripts/check-similarity.mjs` 比较我方源码树与参考源码树的词元 k-gram（类似 MOSS 的 winnowing），只输出路径和数字，因此可以对不允许阅读的代码运行：

```sh
node scripts/check-similarity.mjs --ours src,native/pty-server/src,scripts,test \
  --theirs <参考目录>[,…] --json <report.json>
```

这个工具只报告。对原始相似份额达到 0.15 或以上、或有超过 40 个词元的原始连续匹配的文件要调查，并人工复核归一化排名靠前的匹配（小文件、词典和 CSS 块在结构上得分偏高）。参考源码树放在仓库之外。在较大的终端改动之后和发版之前运行它。
