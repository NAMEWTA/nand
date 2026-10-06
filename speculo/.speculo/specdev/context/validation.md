# 仍未验收

下面各项在写入本文时仍然成立。旧 change 里的原文保留，不把它们改写成已经完成。

## 平台与宿主

- 没有把 Obsidian `1.12.0` 的实机运行写成通过。声明的最低版本只是 manifest 里的 `minAppVersion`。
- 没有手机硬件验收，没有把输入法、第三方主题或长期运行曲线写成通过。
- 六种 CLI 的真实登录、启动、恢复和额度没有用真实账号重跑。历史扫描和恢复边界有本地测试，那不是已登录 CLI 的验收。

## 工作台

- 习惯／记账作为独立工作台页面（P5）未做。
- `2026-10-05-unified-workbench` 里记录的探针哈希 `eaa38f7be25f64b699c049e350eda0b61331f6502c9b6ea7ac99149e7f8f06f0` 和 `0d5b30511c80c1dc071b3feec673bdf3fd4d0745a1abc3675672a638399af85e` 都不覆盖此后的新 `main.js`。新的宿主探针必须记下当次源码提交和新建的 `main.js` sha256。

## 编辑器增强

`2026-10-04-editor-enhancements` 里的上游样例、四个 `EditorDomain` 接线、真实剪贴板和实机验收仍未完成。核心里的纯规则和命名测试不等于功能已经接到编辑器。

## 其余实机项

`2026-10-01-remaining-acceptance` 的最低版本、移动端、真实 CLI、WeRead 真实账号和长期并发仍未全部验收。不因文档整理把这些勾掉。

## 文档资产处置

机器门禁按仓库里的 Markdown 归类，未归类文件必须为 0。下表是处置，不是扫描日志。

| 范围 | 处置 |
|---|---|
| `README.md`、`CHANGELOG.md`、`CLAUDE.md`、`SECURITY.md`、`dashboard-template.md` | 核对入口。`SECURITY.md` 只说明报告方式，没有悬赏或安全邮箱。变更说明的未发布节只记已经改过的行为 |
| `docs/`，含 `workbench.md`、`privacy.md` | 去掉过期的通讯录功能区入口。其余核对后保留 |
| `LICENSE`、`NOTICE`、`docs/third-party/`、`src/core/icons/res/NOTICE.txt` | 保留许可与来源 |
| `.agents/skills/` | 核对后保留 |
| `context/current-baseline.md`、`validation.md` | 新增。仍未完成的事实写在这里 |
| `status.json` 的三个 active change | 仍打开。事实已经摘出，对应工作没有完成，所以不归档 |
| `archive/`、`adr/`、`changes/` | 保留。旧探针哈希不改写成当前通过 |
| `speculo/skills/`、`speculo/workflows/`、`speculo/commands/` | 工具文档保留，不改写成 NAND 专用说明 |
| `src/core/contacts/persist/format-guide.md` 与英文版 | 仍是给用户库的协议示例。不覆盖用户已经生成的 `档案格式说明.md` |
| `legacy/`、`old/`、`backup-docs/` | 不新建。仓库里没有这些目录 |

## 档案规模

`pnpm run accept:contacts-scale` 不在 `test:all` 里。它写入临时 Markdown，建完索引后删除文件，再对内存索引查询 20 次。命中必须恰好一条。P95 不超过 100 毫秒仍是目标；下表只是这一台机器的测量，不是产品保证。

- 状态：`passed`
- 命令退出码：0。搜索词是 `nand-scale-needle`。不用 `token-42`，因为整段子串也会命中 `token-420`。
- 机器：Linux x64，Node v24.21.0。`os.cpus()` 返回 8，型号 `12th Gen Intel(R) Core(TM) i7-12700`，内存约 23 GB。容器报告的 CPU 数不一定是这颗处理器的物理核心数。

| 条数 | 写入字节 | 建索引（毫秒） | 删文件后热查询 P95（毫秒） |
|---|---:|---:|---:|
| 100 | 666779 | 95 | 0.84 |
| 1,000 | 6670679 | 486 | 6.37 |
| 5,000 | 33366679 | 2511 | 27.45 |

本机三次热查询 P95 都低于 100 毫秒。建索引的时间不是这项查询目标。没有把这些毫秒写进用户指南。
