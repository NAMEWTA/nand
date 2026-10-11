# CI 修复与 Windows 验收补充

2026-10-11。用户要求继续修复失败 CI，并确认本轮以 Windows 验收为准；真实账号和其他平台未验证记录保留，不再阻塞本轮完成。发布版本仍另由 [#148](https://github.com/NAMEWTA/nand/issues/148) 跟踪。

原失败流水线：[38102505664](https://github.com/NAMEWTA/nand/actions/runs/38102505664)。Linux Node 24 为 41/50，Windows 为 39/50；此前仅报告 Vitest 通过不足以证明完整 test:all 通过。

## 修复内容

- Preact 模态框夹具补齐 document；图书库夹具补齐 metadataCache 订阅及释放接口；倒计时弹窗使用 ownerDocument.defaultView 的完整计时器接口。
- 图书库卡片大小和视图菜单原本引用缺失的动态翻译键，现补齐 8 组双语文案并使用静态键引用。
- 布局测试按当前 widget mount、稳定 member ID 和成员可排序合同验证；CSS 变量读取真实 style；页面关闭测试走公开 closeResource 接口。
- Git 恢复内容比较兼容 CRLF；Git 与自动化临时目录先 realpath，覆盖 Windows 短路径别名；自动化准备失败会报告 scheduler 结果，避免顶层 await 静默悬空。
- #150 农历顶部干支信息为求签按钮预留空间，按钮至少 32px；日期行保留原宽度。源码和 main.js/styles.css 同步提交。

## 本地验证

Windows、Node 24.21.0、pnpm 11.1.3。使用 CI 相同的 GIT_CONFIG_COUNT=1、core.autocrlf=true：`pnpm run test:all` **50/50 通过**，其中 Vitest **805 passed / 4 skipped**。构建、lint、CSS、i18n（3818 keys）、文档、bundle budget、notices 均通过。main.js/styles.css 未提高预算，styles.css 为 756480 字节。

真实 Windows Obsidian 使用全新隔离测试库。农历布局中英文 × 三种主题 × 明暗 × 500/800/1500 三宽度共 **36 场景通过**；500px 的 12 场景确认原有响应式隐藏，其余 24 场景实际展开组件，确认按钮与文字无交叠、无横纵裁切。截图检查后将留白限定到顶部信息，避免日期被挤压。

- [原生验收结果](../../2026-10-08-home-grid-rebuild/evidence/review-lunar-layout.json)
- [英文界面截图](../../2026-10-08-home-grid-rebuild/evidence/lunar-layout-en.png)
- 可重跑入口：scripts/obsidian-acceptance/home-lunar-layout.mjs，要求 NAND_OBSIDIAN_EXECUTABLE 与不存在的隔离测试目录。

真实账号、其他操作系统原生界面和真实手机未因此变成已验证。原逐票记录继续保留这些限制。

## 远程流水线

修复提交推送后核验 Linux Node 22、Linux Node 24、Windows Node 24；后续完成记录追加最终 run 和结果，不以本地通过冒充远端通过。

首轮修复 [2ce9e6b](https://github.com/NAMEWTA/nand/commit/2ce9e6b49718ac5691085c02db6a6a01412c9c82) 的 [CI 38104470019](https://github.com/NAMEWTA/nand/actions/runs/38104470019)：Linux Node 22/24 全部通过；Windows 剩余 2 项为路径别名。普通 realpathSync 保留 8.3 短名，已改成 realpathSync.native。用本地新建临时目录的真实 8.3 路径复现两种解析结果，在该 TEMP/TMP 及 core.autocrlf=true 下重跑 safety-regressions 和生产 clone 用例，均通过。

最终修复 [59a3faf](https://github.com/NAMEWTA/nand/commit/59a3faf25150d5be0deb26da8993c80d93410b96) 的 [CI 38104882627](https://github.com/NAMEWTA/nand/actions/runs/38104882627) 已回读为 **success**：Linux Node 22、Linux Node 24 和 Windows Node 24 三个 job 全部成功。Linux 的 notices 和 Rust check:native 也已执行并通过。归档与票级完成记录以此源码 checkpoint 为准。
