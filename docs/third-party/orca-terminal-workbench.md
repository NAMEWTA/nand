# Orca 来源与适配范围

终端参考固定提交 [11d97896628d90c4990365127812667b00e28c82](https://github.com/stablyai/orca/tree/11d97896628d90c4990365127812667b00e28c82)（Orca v1.4.217）；浏览器参考固定提交 [d74388f8a2dad2bd4bbfe3b937aba66e6648258b](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b)。这些是代码来源标识，不表示跟随上游最新版本。

Copyright (c) 2026 Lovecast Inc. 完整 [MIT 许可证](orca-LICENSE.txt)保持原文，并嵌入构建产物 main.js 的许可证声明。

| 参考内容 | NAND 中的适配 |
|---|---|
| 最近会话切换 recent-tab-switching | 稳定 MRU 顺序、去重、移除失效身份与活动会话优先，使用 Obsidian 原生建议界面 |
| pane-fit-resize-observer、pane-fit-client-size | 合并终端尺寸检查，等待稳定字符尺寸，避免重复调整 PTY；使用所属 Window 与公开 FitAddon 接口 |
| terminal-webgl-hidden-retention | 实例级 LRU，初始保留两个隐藏图形上下文；可视渲染器不拥有 PTY 生命周期 |
| structural replay、scroll buffer snapshot、scroll intent | 权威 headless 快照重放、实时输出衔接及滚动意图恢复 |
| 浏览器会话、页面交互及材料采集 | Vault 分区、原生标签页／弹窗、版本快照、元素材料与标注，通过显式端口协作 |

NAND 使用自身 Preact 面板、Obsidian 叶子、主题令牌和 Rust 协议 2。没有引入 Orca 应用状态树、窗格树、Electron 主程序或私有 xterm 渲染补丁；适配回归测试不等于上游应用兼容性保证。
