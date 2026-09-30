# Open issue 修复记录（2026-09-30）

本轮以 `5a9b73554bf3c4231d8ae82679153cde04cb27da` 为基线，处理当时全部 13 个 open issues。版本保持 0.0.3；本次更新源码及提交的 `main.js`，不创建发行版。

| Issue | 修复结果 | 验证 |
| --- | --- | --- |
| [#46](https://github.com/NAMEWTA/nand/issues/46) | 会话区改为可折叠的顶部区域；按词换行，保留完整终端宽度；短窗口中限制辅助区域高度并允许滚动 | 中英文 × 4 个窗口；同时展开两侧栏、最小 800×500；折叠及语言切换保留 xterm |
| [#64](https://github.com/NAMEWTA/nand/issues/64) | 每组标题、空提示、选项放进同一 section，组内紧凑、组间分隔 | 联系人／企业、中英文；空组、含选项组；取消不改变筛选，应用更新筛选 |
| [#66](https://github.com/NAMEWTA/nand/issues/66) | 全部横幅统一黑色渐变遮罩及独立照片文字颜色 | 13 主题 × 明暗；按实际计算样式与纯白底图计算最差对比度，至少 5.87:1；检查明暗混合背景截图 |
| [#67](https://github.com/NAMEWTA/nand/issues/67) | 提醒、确认、阅读及今日日期使用正确前景；SVG 继承颜色；宿主主题变化重新计算 | 抹茶／丁香 × 明暗；实际组件、hover、播放／暂停、保存及取消操作；文字 ≥4.5:1、必要图标 ≥3:1 |
| [#68](https://github.com/NAMEWTA/nand/issues/68) | 评论读取、JSON、结构、消息损坏及索引悬空均报错，拒绝缓存为空或覆盖 | 故障修复后用新 store 重读旧评论及新评论 |
| [#69](https://github.com/NAMEWTA/nand/issues/69) | 评论写入先保存可重放意图；dirty 修订在成功提交后清除；重命名提交后才删旧文件 | journal／sidecar／index／cleanup 失败、重启重放、多文件部分写入、写入途中继续编辑 |
| [#70](https://github.com/NAMEWTA/nand/issues/70) | `Vault.process` 比较原文基线；冲突暂停覆盖并保存双方；失败后的本地修改不被 watcher 替换 | 队列和备份等待中的外部修改、备份失败、继续编辑、重新加载；真实 Obsidian Vault 冲突检查 |
| [#71](https://github.com/NAMEWTA/nand/issues/71) | WebSocket error、close、timeout 均结束启动等待；按连接身份清理 | 并发启动、各失败路径、复用进程重试、旧连接迟到回调 |
| [#72](https://github.com/NAMEWTA/nand/issues/72) | 关闭后可重新启动同一 manager；生命周期代号隔离旧回调并取消重启定时器 | 最后一个终端关闭后重开、自动重连、启动途中关闭；真实 Obsidian 命令回显 |
| [#73](https://github.com/NAMEWTA/nand/issues/73) | 监听真实 exit／close；SIGTERM 超时后 SIGKILL；退出失败保留进程所有权 | 忽略 SIGTERM 的真实 Node 子进程；假进程模拟 SIGKILL 后仍未退出；并发 shutdown |
| [#74](https://github.com/NAMEWTA/nand/issues/74) | 按 epoch 分钟推进 cron／HOURLY，避免本地时间重新解释重复小时 | 纽约回拨两个小时各执行一次；Lord Howe 半小时回拨／跳时；next／latest 单调性 |
| [#75](https://github.com/NAMEWTA/nand/issues/75) | 空选项清空任务路径与卡片 ID；保存重新核验目标存在 | 清空后拒绝保存，重新选择后成功保存 |
| [#76](https://github.com/NAMEWTA/nand/issues/76) | 在异步启动前预留 agent／规范化账户／原生会话组合；失败释放 | 同一次 scheduler tick 的两个自动化只启动一次；返回 busy；准备失败可重试，其他会话可启动 |

## 验证环境与结果

- Debian Linux，Node 24.19.0、pnpm 11.1.3、Rust 1.98.1；独立 Obsidian 1.13.7 测试库。
- `pnpm run build` 成功；`pnpm run lint` 0 errors、152 warnings（基线 153 warnings）。
- 50 个 `test:*` 命令全部通过。面板测试中依赖首个按钮及逐字换行的旧断言，已按新行为更新并重新通过。
- `cargo test --locked --manifest-path processes/rust-terminal-servers/Cargo.toml`：30 passed。
- Rust PTY／历史集成：命令输出、退出顺序、进程树取消、并发索引、查询、完整记录读取和源文件完整性通过。
- 新增 `test:safety-regressions` 并纳入 Node 22／24 CI 配置；本地执行的是 Node 24。未在本轮声称已执行远端 CI、macOS／Windows 或真实付费智能体调用。

## 重跑原生验收

使用独立测试库，安装本分支构建的插件与匹配的 Linux 终端二进制；启用插件和终端离线模式，关闭首次信任／介绍弹窗，打开一个终端。启动 Obsidian 时启用 `--remote-debugging-port=9237`，然后在仓库根目录执行：

```sh
NAND_CDP_URL=http://127.0.0.1:9237 \
NAND_ACCEPTANCE_DIR=/tmp/nand-issue-acceptance \
node scripts/obsidian-acceptance/run.mjs
```

此手动验收会改变测试库的主题、语言、阅读记录、看板内容及会话，并创建后删除测试联系人。不要对日常资料库运行。截图与 JSON 结果写入指定目录；它不属于默认 `test:*` 或 CI。提醒 picker 使用当前源码构建的真实 Preact 组件挂载到 Obsidian，其他入口通过已安装插件操作。

## 数据恢复行为

评论未完成写入保存在 `.nand/editor/comments/pending.json`，后续操作或重新启动 store 会重放。存储故障会提示错误，不能把未写入成功的内存修改视为已保存；强制退出前尚未落盘的数据没有持久化保证。

看板冲突副本位于 `.dashboard-backup/conflicts/*.json`，包含 `path`、`base`、`local`、`candidate`、`remote`，不参与普通五份备份轮转。先检查、合并需要的内容，再重新打开看板或使用恢复操作。恢复副本写入失败时保持当前看板打开，待存储恢复后重试。

`Vault.process` 使用 Obsidian 支持的原子读改写接口，不构成对所有绕过 Obsidian 的外部操作系统写入者的全局锁。评论写入记录也不替代磁盘硬件／文件系统的持久化保证。
