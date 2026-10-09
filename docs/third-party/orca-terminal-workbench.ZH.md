[English](orca-terminal-workbench.md) | 简体中文

# Orca 来源与适配范围

NAND 改编了 [Orca](https://github.com/stablyai/orca)（stablyai/orca）的部分内容。Orca 使用 MIT 许可证，Copyright (c) 2026 Lovecast Inc.。完整的 [MIT 许可证](orca-LICENSE.txt)保持原文，并嵌入构建产物 `main.js` 的许可证声明。署名摘要见 [NOTICE](../../NOTICE)（仅英文）。

每个改编的源文件都在头部注释里写明上游。下面的上游提交只用来标识代码取自何处，并不表示 NAND 跟随 Orca 的最新版本。

| 上游 | 提交 |
|---|---|
| Agent 运行时、自动化调度 | [27b823f934f739bc85914dd717b776835f60bcf7](https://github.com/stablyai/orca/tree/27b823f934f739bc85914dd717b776835f60bcf7) |
| 终端工作台（Orca v1.4.217） | [11d97896628d90c4990365127812667b00e28c82](https://github.com/stablyai/orca/tree/11d97896628d90c4990365127812667b00e28c82) |
| 浏览器 | [d74388f8a2dad2bd4bbfe3b937aba66e6648258b](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b) |

## 终端工作台（11d97896）

| Orca 的部分 | NAND 中的位置 |
|---|---|
| `recent-tab-switching` | `src/modules/agent/core/terminal/recent-sessions.ts`：稳定的最近使用顺序、去重、移除失效身份、活动会话优先。选择器是 Obsidian 的建议弹窗。 |
| `pane-fit-resize-observer`、`pane-fit-client-size` | `src/modules/agent/ui/terminal/stable-terminal-fit.ts`：合并尺寸检查，等待稳定的字符尺寸，避免重复调整 PTY 大小。使用所属窗口和公开的 `FitAddon` 接口。 |
| `terminal-webgl-hidden-retention` | `src/modules/agent/ui/terminal/hidden-renderer-retention.ts`：实例级 LRU，最多保留两个隐藏的图形上下文。可见的渲染器不拥有 PTY 的生命周期。 |
| `terminal-structural-replay-coordinator`、滚动缓冲快照、滚动意图 | `src/modules/agent/ui/terminal/terminal-presentation.ts`：依据权威的 headless 快照重放，与实时输出串行衔接，并恢复滚动意图。 |

## Agent 运行时与自动化调度（27b823f）

| Orca 的部分 | NAND 中的位置 |
|---|---|
| 共享的 Agent 配置：启动命令、权限参数、安装与升级命令、用量类型 | `src/modules/agent/core/launch/catalog.ts`（同时承载自动化的提示词传递方式） |
| 原生恢复能力集合 | `src/modules/agent/services/agent-runtime.ts` |
| 原生会话布局、Claude 项目路径编码、历史范围 | `src/modules/agent/platform/desktop/history/scope.ts`；历史格式见 `native/pty-server/src/agent_data.rs` |
| 原生生命周期钩子与扩展 | `src/modules/agent/platform/desktop/hooks/native-extensions.ts` |
| 调度与 cron 解析、下一次触发时间计算 | `src/modules/automations/core/schedule/`（`automation-cron-field-parsing.ts`、`automation-cron-occurrence.ts`、`automation-schedule-occurrences.ts`、`automation-schedule-parsing.ts`） |

## 浏览器（d74388f）

| Orca 的部分 | NAND 中的位置 |
|---|---|
| 无障碍树快照遍历 | `src/modules/browser/core/snapshot-ax-tree-walk.ts`、`src/modules/browser/platform/desktop/snapshot-engine.ts` |
| 可交互元素发现 | `src/modules/browser/platform/desktop/snapshot-cursor-interactive-elements.ts` |
| 截图标注模型 | `src/modules/browser/core/markup-model.ts` |
| 元素抓取上下文 | `src/modules/browser/platform/desktop/grab-script.ts` |
| 调试器租约归属 | `src/modules/browser/platform/desktop/debugger-lease.ts` |
| 弹窗分类 | `src/modules/browser/platform/desktop/guest-policy.ts` |
| 网址分类 | `src/shared/web-url.ts` |

## NAND 不采用的部分

NAND 使用自己的 Preact 面板、Obsidian 叶子、主题令牌和 stdio 辅助进程（协议 3）。不使用 Orca 的应用状态树、窗格树、Electron 主进程和私有的 xterm 渲染补丁。回归测试覆盖被改编的行为，不构成与 Orca 应用兼容的保证。
