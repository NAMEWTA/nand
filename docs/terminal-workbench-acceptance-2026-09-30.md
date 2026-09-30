# AI 终端工作台验收记录（2026-09-30）

本轮实现保留 CLI 原生终端，将导航改为左栏／窄屏抽屉，历史全文放到主区域。Orca 参考版本、来源文件及许可见 [来源记录](third-party/orca-terminal-workbench.md)，使用方法见 [工作台说明](agent-workbench.md)。

## 环境与证据范围

- Windows x64，Obsidian 1.13.7，Node 24.21.0，Intel i7-12700K，64 GiB 内存。
- 使用独立 Obsidian profile、隔离库及 provider 目录；运行前验证 marker、随机 nonce、绝对库路径和离线 native binary。没有调用真实账号的付费服务。
- 基线代码：`8a72dd1400b09854196591898f24437b5e96ebfa`。工作台实现为 `538bf78`，真实应用验收补修见 `9768880`、`7211703`、`46e18ac`。
- 最终主程序 SHA256：`8d3b1c4cc2d90d78b7676635ccbc01997a3d76f03fb546017b01131d8f1a3b27`；样式 SHA256：`fe5585e5a42b181e67b012f1aa849b34c3904c791ff6d294ac64b0c5d7f80e80`。
- 本机 native binary SHA256：`a7a2e6eec174cf0b7a82b018e8b1fe28ecd3ba458131e053c74f5431fb40691c`。
- 原始 JSON、截图及日志保存在仓库忽略的 `scripts/tmp/terminal-workbench-2026-09-30/` 和 `scripts/tmp/orca-history/`。测试脚本随源码提交，可重建隔离夹具复跑；重启脚本另有固定任务 profile 和进程身份校验。
- 共享目录中途出现另一项浏览器模块的在制文件。最终构建、lint 与面板检查移至只包含本轮已提交代码及修补的独立 worktree；这些并行改动未删除、未纳入本轮提交。

## 问题与回归

改动前的定向 UI 基线有 7/7 项不满足验收条件，包含重复恢复、固定窄小历史预览、缺少左栏／抽屉、列表暴露会话 ID，以及搜索或编辑原生日志后刷新失效。先保存失败证据，再实施修复；其原始记录为 `scripts/tmp/e2e-2026-09-30/orca-ui-baseline.json`。

| Issue | 已复现的问题 | 对应回归 |
| --- | --- | --- |
| [#88](https://github.com/NAMEWTA/nand/issues/88) | 上下区域挤压主终端、140px 历史区域、宽屏无效抽屉 X、拖动条只有 32px 高、Tab 循环遗漏用量展开入口 | 240–360px 导航、全高拖动条、800px 抽屉边界、16 组语言/主题/宽度、全文主区、summary 双向 Tab 边界 |
| [#89](https://github.com/NAMEWTA/nand/issues/89) | Resume 等待期间重复点击创建多个终端 | 进行中禁用、同步提交锁、跨重绘/迁移去重、失败后可重试 |
| [#90](https://github.com/NAMEWTA/nand/issues/90) | 隐藏浏览器消费继续、ANSI 尾部截断、快照重复 prefix、标记积累 | 解析屏障、完整快照与增量串行、隐藏订阅为零、WebGL LRU、1,000 条上限 |
| [#91](https://github.com/NAMEWTA/nand/issues/91) | 搜索/翻页后刷新不扫描、选中预览陈旧 | 显式刷新、版本订阅、查询/选择保留、预览重新读取、多视图元数据同步 |
| [#92](https://github.com/NAMEWTA/nand/issues/92) | 分页先解析全部全文，20,000 条 p95 约 2 秒 | 摘要/全文分表、SQL 分页与聚合、短事务、WAL 独立读取、排队取消 |
| [#93](https://github.com/NAMEWTA/nand/issues/93) | 关闭未就绪叶子后等待挂起，自动初始化覆盖选择，懒加载复活关闭叶子 | 七项生产视图生命周期回归、迁移清理、MRU 跳转已有页面 |
| [#94](https://github.com/NAMEWTA/nand/issues/94) | 使用 Obsidian 主题的终端保留旧色，弹出窗口主题传播晚于主窗口事件 | 所属文档主题类观察、所属窗口合并调度、迁移／关闭解绑、隐藏恢复、自定义配色保留 |
| [#96](https://github.com/NAMEWTA/nand/issues/96) | 原生弹出窗口返回终端后仍标记隐藏，输出消费和主题未恢复 | 激活／焦点／尺寸／迁移下一帧重同步可见性，旧窗口监听清理，真实双窗口输出往返 |

## 历史性能

同机同脚本分别运行基线和优化 native binary；隔离旧索引含 500／5,000／20,000 条，每条全文 10,240 字节。每组一次冷查询加 20 次热查询，表内 p50/p95 仅包含热查询。

| 历史条数 | 基线 p50 / p95 | 优化 p50 / p95 | 优化首次查询（含迁移） |
| --- | --- | --- | --- |
| 500 | 51.3 / 55.8ms | 21.0 / 23.9ms | 142ms |
| 5,000 | 524.7 / 554.4ms | 112.5 / 117.3ms | 1,137ms |
| 20,000 | 2,020.3 / 2,149.3ms | 446.8 / 491.2ms | 4,933ms |

5,000 条组原生解析数据量由约 53.61MB 全文降至 47.5KB 摘要；20 次热查询的 native CPU 累计由 10.27 秒降至 2.06 秒，进程峰值工作集由 73.8MB 降至 14.8MB。20,000 条峰值工作集由约 248MB 降至 16.8MB。前后每组请求数均为 21；这些是实际查询成本，另有共享 scan/query/usage 的去重回归，未用请求数变化代替查询性能。

迁移存在明确冷启动成本；失败事务回滚并保留旧索引、来源/更新时间及全文。目标 5,000 条热查询 p95 ≤500ms 已达到。该基准保留子串搜索语义，不声称任意全文内容、磁盘或工作集均有相同延迟。

## 真实 Obsidian 渲染性能

空闲原生 Shell 数量为 1／10／30；每组 20 次热切换（包含两帧呈现等待）。以 10Hz 向真实 headless 会话注入合成 VT 输出，持续 3 秒，测量浏览器呈现成本。基线与验收均使用 1280×800、deviceScaleFactor=1；窗口必须可见，后台窗口的计时不计入结果。

| 会话数 | 基线 p50 / p95 | 验收第 1 轮 p50 / p95 | 验收第 2 轮 p50 / p95 | 浏览器输出订阅：前 → 后 | WebGL：前 → 后 |
| --- | --- | --- | --- | --- | --- |
| 1 | 15.0 / 15.8ms | 15.2 / 15.7ms | 15.4 / 15.7ms | 1 → 1 | 1 → 1 |
| 10 | 46.0 / 55.8ms | 42.4 / 57.5ms | 42.8 / 55.2ms | 10 → 1 | 8 → 3 |
| 30 | 50.5 / 66.7ms | 55.0 / 67.4ms | 52.0 / 74.3ms | 30 → 1 | 17 → 3 |

所有热切换 p95 均达到 ≤150ms 目标，延迟与基线相近，30 会话略有增加。隐藏会话不再持续消费浏览器输出，WebGL 只保留当前可见会话和最多两个隐藏会话；原生 PTY 与 headless 状态继续更新。

同时记录整体进程指标，避免将资源数量变化当作整窗性能收益：

| 会话数 | 3 秒浏览器任务 CPU 时间：基线 / 第 1 轮 / 第 2 轮 | renderer private memory：基线 / 第 1 轮 / 第 2 轮（KiB） |
| --- | --- | --- |
| 1 | 0.147 / 0.260 / 0.247s | 252,216 / 373,728 / 405,236 |
| 10 | 0.326 / 0.275 / 0.280s | 322,288 / 427,972 / 463,208 |
| 30 | 0.646 / 0.390 / 0.356s | 488,340 / 611,064 / 576,112 |

多会话合成输出的浏览器任务 CPU 时间在本次采样下降，单会话及 private memory 未改善。这些整窗指标受 Electron profile 内其它页面、热重载和累计图形资源影响，本轮未证明整窗资源一致下降。历史查询的独立 native 进程测量与这里的整窗测量分开报告。

## 真实 Obsidian 功能与视觉

最终构建的亮／暗主题 × 中／英文 × 320／480／800／1280px 叶子宽度，在两轮中各 16/16 通过。使用 Obsidian 的真实主题切换命令和本机 DPR 1.25，填入 125 条历史、100 行列表和超过 10KB 的选中全文；检查终端尺寸、主区域、按钮边界、抽屉、全高拖动条和主题颜色。人工复核宽屏及 320px 截图，历史全文可阅读，没有被遮挡的产品操作按钮。

[宽屏实际截图](agent-workbench.png) · [320px 窄屏实际截图](agent-workbench-narrow.png)

最终证据目录为 `scripts/tmp/terminal-workbench-2026-09-30/final-complete-round1/` 和 `final-complete-round2/`。两轮按相同顺序串行运行，没有代码或部署物变更，没有新增可复现问题。较早的 `exploration*`、`clean-round*`、`final-round1` 包含调试及修复前结果，不作为最终通过证据。

| 套件 | 每轮结果 | 实际验证 |
| --- | --- | --- |
| `terminal.mjs` | 16/16 | 主题、语言、叶子宽度、真实 Tab/Shift+Tab/summary/Escape、尺寸、全文、按钮边界 |
| `terminal-history-flows.mjs` | 7/7 | 125 条历史分页 100/25、选中 13,915 字符全文刷新、原生弹出窗口、跨窗口改名/收藏/归档、完整导出、主题与自定义配色、重复 Resume 只执行一次本地 CLI |
| `terminal-session-flows.mjs` | 8/8 | 实际新建菜单与导航、中文输入/粘贴、最近会话跳转已有 leaf、关闭 leaf 后同 PID 后台继续、超过 2MB 原生输出的隐藏恢复、跟随底部/非跟随滚动、WebSocket 重连 |
| `windows.mjs` | 3/3 | Shell 退出代码 7、重开后 Ctrl+C 保留 Shell、结束会话清理所属子进程 |
| `terminal-performance.mjs` | 3/3 | 1/10/30 个会话，p95 ≤150ms、输出订阅 1、WebGL 最多 3 |
| `terminal-restart.mjs` | 6/6 + 独立复核 | 正常退出指定 Obsidian 进程、同 profile 新 PID 重启、316px 导航和查询/过滤持久化、历史元数据保留、没有重发提示词；脚本退出后另一次工具调用验证存活与全部部署 hash |

两轮结束均为 0 个测试会话、0 个终端 leaf。日常 Obsidian 配置 SHA256 始终为 `178edb725cb3ce9c12825b41b5ae619e11838b094c464b6e1cbd20e37b5f0709`。

画面比较使用 xterm 公共 VT buffer，严格比较文本、换行、光标、行数和网格。唯一规范化是双方已满 scrollback 时第 0 行的 `isWrapped` 标记：它的前驱行已被裁掉，官方 SerializeAddon 重放会将该标记变为 false。用现装 headless 6.0.0／SerializeAddon 0.14.0 独立重现 2,359,530 字符后，唯一差异也是该标记；所有其它字段保持严格比较，原始标记和规范化条件写入结果。复现脚本/结果为 `serialize-trimmed-origin-repro.mjs` / `.json`，位于同一证据根目录。字体与主题另由实际截图验证。

重连测试关闭真实客户端 WebSocket，并观察自动恢复及原生输入输出。当前服务策略会终止旧 PTY、创建新的 native session ID 和 PowerShell PID；逻辑会话、leaf 和 renderer 保留。关闭 leaf 后保留后台进程与 WebSocket 断线后的进程重建是不同场景，均单独验证。

## 自动检查

- 生产构建通过，`main.js` 与源码一并提交。
- ESLint：0 错误、151 条现有警告；本轮基线为 152 条。
- 终端测试 234/234（包含 #96 四项可见性、#94 两项跨窗口主题先失败后通过的回归）；面板组合 7 组；Rust locked tests 34/34；匹配本机 release binary 的 Windows 原生集成 11/11。
- 架构、Promise callback、设置、自动化 39 项、dashboard isolation 和 safety regressions 通过；后者含实际 Windows 子进程退出。
- 最终产品提交 `46e18ac` 的 [Node 22/24 与 Windows portability CI](https://github.com/NAMEWTA/nand/actions/runs/36756265505) 和 [五平台原生构建/测试](https://github.com/NAMEWTA/nand/actions/runs/36756265812) 全部通过，后者含 Windows PTY 集成。验收脚本及本报告随后的提交检查见 [PR #95 checks](https://github.com/NAMEWTA/nand/pull/95/checks)。

## 复跑

`scripts/benchmark-native-history.mjs` 接收 matching native binary 和隔离证据目录。它保留生成数据，关闭自己创建的服务。

真实应用脚本位于 `scripts/obsidian-acceptance/`，要求 `NAND_ALLOW_WINDOWS_E2E=1`、与当前隔离库 marker 完全一致的 `NAND_WINDOWS_E2E_NONCE` 和绝对 `NAND_ACCEPTANCE_DIR`。脚本应在同一 Obsidian 实例中串行运行。不要把测试 marker 写到日常库绕过验证。

终端性能测试使用真实 native 空闲 Shell 和浏览器渲染器，对 headless 注入可重复的合成输出；它验证渲染资源和切换，不代表远程模型吞吐。`NAND_PERF_EXPECT_OPTIMIZED=1` 启用订阅/WebGL/150ms 断言，默认 deviceScaleFactor=1 与基线一致。

## 限制

真实提供方账号登录、收费请求、订阅额度、macOS 钥匙串和手机 GUI 不在本轮本机验收范围。CLI 替身验证只能证明参数与本地恢复流程。中文输入使用 CDP 已提交文字和 DOM paste 事件，未覆盖 Windows 输入法候选框和系统剪贴板。跨平台 CI 的编译/原生测试不等同于各平台 Obsidian GUI 通过。整窗 CPU 与内存会受 Electron 热重载、其它页面和图形驱动影响，不能仅凭隐藏 WebGL 数下降宣称整窗资源下降。
