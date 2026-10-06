# 当前基线

这份说明只记录仍然成立的事实。它不把待测目标写成已经测得的结果，也不把旧的 `main.js` 哈希改写成当前构建已通过。

- 版本仍是 `0.0.1-alpha1`。`minAppVersion` 仍声明为 `1.12.0`。声明不是「已在 1.12.0 上验收通过」。
- 唯一功能区入口是「打开工作台」（`open-workbench`）。设置页的 `home` 是插件设置。工作台首页的功能 ID 是 `dashboard`。
- 习惯和记账仍是看板小组件。把它们做成独立工作台页面（原 P5）没有做。
- 档案搜索是整段子串，按一个片段匹配，排序仍是名称或修改时间。热查询读内存索引。磁盘上的 1,000 / 5,000 条计时若已测量，只写在 [validation.md](validation.md)，不写进用户指南当作承诺。
- 三个仍在进行的 change 保持打开：`2026-10-01-remaining-acceptance`、`2026-10-04-editor-enhancements`、`2026-10-05-unified-workbench`。未完成项见 [validation.md](validation.md)。
