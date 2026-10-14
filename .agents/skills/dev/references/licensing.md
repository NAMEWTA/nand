# 许可

NAND 使用 MIT 许可证（`LICENSE`）。保持这一点：发布在 `main.js`、`styles.css` 或辅助程序里的一切，都必须与 MIT 分发兼容并有恰当署名。这是工程实践，不是法律意见。

本次上游版本、逐文件映射与声明目标见 [13 参考映射与许可](../../../../docs/refor/13-参考映射与许可.md)。阶段 0 更新规则，依赖与声明生成器随对应实施阶段落地；不把规则写入视为已分发这些依赖。

## 署名放在哪里

| 文件 | 内容 | 维护方式 |
|---|---|---|
| `LICENSE` | NAND 的 MIT 许可证，只有英文 | 手写 |
| `NOTICE` | NAND 改编的作品：apex-dashboard 与 obsidian-dashboard（MIT，看板设计）、Orca（MIT，含提交对应关系）、Margin Comments（MIT）、shadcn/ui（MIT）、Iconic（MIT-0）、obsidian-git（MIT，Git 同步）；只有英文 | 手写 |
| `src/modules/icons/core/res/NOTICE.txt` | Lucide（ISC）、源自 Feather 的图标（MIT）、Unicode 数据和其他图标资源 | 手写；随横幅发布 |
| `docs/third-party/orca-terminal-workbench.md`、`orca-LICENSE.txt` | 固定的 Orca 提交和改编内容；Orca 许可证原文 | 手写 |
| `THIRD-PARTY-NOTICES.md` | 打包进 `main.js` 的 npm 包、内嵌 `styles.css` 的 CSS/字体、链接进 `nand-pty` 的 crate，附许可证原文 | `pnpm run notices`；CI 运行 `check:notices` |
| `src/ui/fonts/LICENSE.txt` | Geist / Geist Mono 的 SIL OFL 1.1 全文 | 随字体保留并纳入 notices |
| `main.js` 横幅 | `LICENSE`、`NOTICE`、图标资源声明、Orca 许可证、打包依赖的许可证 | `scripts/esbuild-options.mjs` |

`LICENSE` 和 `NOTICE` 是法律文本，没有 `.ZH` 对应文件。`NOTICE` 和其他进入横幅的文件是纯文本，因为它们被嵌入 `main.js` 顶部的注释里。

Release 附件包含 `LICENSE`、`NOTICE` 和 `THIRD-PARTY-NOTICES.md`。

## 添加依赖

1. 检查许可证。MIT、ISC、BSD、Apache-2.0、MIT-0、CC0、Unicode 和 Zlib 可以用；Geist / Geist Mono 字体按 SIL OFL 1.1 分发并保留全文。GPL、AGPL、LGPL（用于打包的代码）、SSPL 和「无许可证」不行；先询问。
2. 尽量从需要它的模块里用懒加载 `import()`；用 `pnpm run check:bundle` 检查。
3. 运行 `pnpm run notices`，保留重新生成的 `THIRD-PARTY-NOTICES.md` 并跑 `pnpm run check:notices`；用户授权提交时一起提交，不能手改生成文件。
4. Rust crate 使用 `--locked` 构建，并重新运行 `pnpm run notices`。

React/React DOM、Radix、clsx、tailwind-merge、cmdk、sonner、zustand、dnd-kit、react-virtual、react-resizable-panels 为 MIT；lucide-react 为 ISC；`class-variance-authority` 为 Apache-2.0，需包含许可全文。Tailwind 与 `tw-animate-css` 的 MIT CSS 和 Geist 字体虽不经过 esbuild，也必须由生成器的 `Embedded in styles.css` 节统计，并参与许可校验；保留 Tailwind 产物的许可注释。

## 改编外部代码

- MIT、ISC 或 BSD 项目的代码可以改编：写一段头部注释，注明来源和上游提交（格式见下方），在 `NOTICE` 里添加或更新条目，并在该上游的第三方说明文档（`docs/third-party/`，中文维护说明，许可证保留原文）里记录文件对应关系。
- 保留上游的许可证文本。`NOTICE` 和 `docs/third-party/orca-LICENSE.txt` 里的版权行照抄上游，不改写。
- Obsidian Copilot 是 AGPL-3.0，只借鉴公开思路，不复制代码、样式或配置；组件源码取自 MIT 的 Orca / shadcn/ui。GPL/AGPL 项目只能用于了解公开行为，编写 NAND 时不要打开或改写其源码。

上游改编文件头必须含项目、固定提交、许可证、版权与原文件路径；CSS 同样保留注释。示例：

```ts
// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/ui/button.tsx
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts (renderSection)
// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/anchor.ts
```

复制时保留布局和 Tailwind 类名，替换宿主、状态与 i18n 接口；apex 许可以 LICENSE 的 MIT 为准。保留 shadcn/ui 原始署名；已删除代码对应的 AIHOT、MAIW 声明按删除清单清理。

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
