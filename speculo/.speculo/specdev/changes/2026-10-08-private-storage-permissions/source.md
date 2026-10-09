---
schema_version: 1
artifact: "source"
change: "2026-10-08-private-storage-permissions"
source_type: "github-issue"
canonical_locator: "https://github.com/NAMEWTA/nand/issues/144"
captured_at: "2026-10-09T03:56:44.592Z"
content_sha256: "f8a9bb4d2f2cc05a6c95d18ddd3cbc42a8beb015c175b28c361e95964eacec6d"
remote_state: "open"
close_capability: "supported"
---

# Source: #144 [数据][加固] 库内 .nand/ 按 umask 创建为 755 / 644（含智能体会话历史索引、浏览状态），建议收紧为 0700 / 0600

## Capture Metadata

- Capture method: GitHub T remote transport issue-read；gh 2.46 无 --slurp，通过临时兼容runner合并 --paginate 数组；保留原transport的两次读取漂移核验。
- Author: NAMEWTA
- Created / updated: 2026-10-08T22:06:44Z / 2026-10-08T22:06:44Z
- Labels: ["enhancement","priority:P3","severity:S4"]
- Pagination: complete；0 comments；source type confirmed issue（非PR）。
- Fetched at: 2026-10-09T03:56:44.592Z
- Hash: UTF-8 紧凑JSON对象title/body/comments（键顺序如列），SHA-256 f8a9bb4d2f2cc05a6c95d18ddd3cbc42a8beb015c175b28c361e95964eacec6d。
- Redactions: 未发现须删除的凭据/秘密；保留公开署名，附件只保留URL。
- Supersedes: 无；本文件是独立 issue 的首次不可变快照，不是同组其他issue的替代版本。
- Deduplication: active/archive此前均为空；无capture；现有ADR是代码基线而非已拒绝请求。

## Original Content

**类型**：加固（低风险）｜**严重程度 / Severity**：S4（轻微）｜**建议优先级 / Priority**：P3｜**复现率 / Frequency**：2/2（全新库、r23 升级库）｜**影响面**：桌面端，umask 为 022 的多用户系统（多数 Linux 发行版默认如此）

## 现状 / Current behavior
插件在库内创建的数据目录 `<vault>/.nand/` 及其子目录按进程 umask 创建。在 umask 022 下，实测**目录都是 `755`、文件都是 `644`**：

```
755 <vault>/.nand
755 .nand/automation/<device-id>        755 .nand/notifications/<device-id>
755 .nand/browser/<device-id>           755 .nand/terminal-agent/<device-id>
755 .nand/config/devices                755 .nand/editor/comments/files
…（共 14 个目录全部 755；17 个文件全部 644）
```

其中有一部分内容是笔记里看不到的：
- `terminal-agent/<device-id>/index.sqlite`：表 `history`、`history_text`、`history_revision`，即智能体会话历史的索引和全文
- `automation/<device-id>/runtime.json`：自动化运行状态
- `browser/<device-id>/state.json`：内置浏览器的标签和网址
- `notifications/`：通知收件箱
- `editor/comments/`：批注正文
- `config/devices/`：本机设置（终端 Shell 等）

对照：
- 同一插件放在 Obsidian 用户数据目录的浏览器运行目录 `nand-browser/` 已经是 `700`，文件是 `600`（`guest-policy.ts:78/83` 显式设了 mode）
- `automation-hooks.ts` 里写的钩子文件也用了 `0o600` / `chmod 0o700`
- 库内 `.nand/` 走 `app.vault.adapter.mkdir`（`src/host/obsidian/storage/document-collection.ts:95-97`，经 `src/shared/storage/durable-state.ts` 的 `ensureDirectory`）和 `adapter.write`，没有指定权限

## 复现 / 检查方法
1. 在 umask 022 的 Linux 桌面上新建库，启用 NAND，打开工作台，用一下终端、浏览器、自动化
2. 执行：
   ```sh
   stat -c '%a %n' <vault>/.nand
   find <vault>/.nand -printf '%m %y %P\n' | sort | uniq -c
   ```
3. r23 旧库原地升级到 1.0.0 后，已有目录同样保持 `755`

## 影响 / Impact（客观评估）
- 只在**同一台机器上有其他本地账户**、并且他们能进入库的上级目录时才有意义；单用户桌面基本无影响。
- 库里的普通笔记在同样条件下也是 `644`（这是 Obsidian 的默认行为，不属于本插件），所以 `.nand/` 并不比笔记更暴露。
- 但 `.nand/` 里有用户未必意识到存在的数据（智能体会话全文索引、浏览记录、自动化提示词），而插件在用户数据目录那一侧已经采用了 `700/600`，库内这一侧却没有，两边不一致。
- macOS 默认 umask 同样是 022；Windows 与移动端不适用 POSIX 权限。

## 建议 / Proposal
- 桌面端（`FileSystemAdapter`）创建 `<vault>/.nand` 时用 `mode 0o700`（或创建后立即 `chmod 0o700`）。至少对 `terminal-agent/`、`browser/`、`automation/`、`notifications/` 收紧；新写入的文件用 `0o600`。
- 插件加载时对**已存在**的 `.nand/` 做一次收紧（只改 `.nand` 自身，或递归处理上述子目录），覆盖升级库。失败时只记日志，不阻断加载。
- 移动端和 Windows 跳过。
- 可在 `docs/data.md` / `docs/privacy.md` 里写一句 `.nand/` 的权限约定。另外提醒：Git 同步不保存目录权限，克隆到新设备后会恢复为 umask 默认值，加载时收紧同样能覆盖这种情况。

## 验收标准 / Acceptance criteria
- [ ] umask 022 下全新库：`.nand` 及子目录为 `700`，新文件为 `600`
- [ ] 从 0.0.1-alpha1 / r23 库升级后，加载一次即收紧为 `700`
- [ ] 移动端、Windows 行为不变；读写和 Git 同步不受影响

## 环境 / Environment
- 被测提交：`21f852bc2d91d60335f57a4bc38a1e663e8b05eb`（main，2026-10-08 22:04 UTC+8）；版本 nand `1.0.0`；平台 linux-x64，umask 0022
- 应用：Obsidian 1.14.4（AppImage 1.13.7 自动更新）
- 终端 helper：因为 1.0.0 Release 尚未发布（#135），使用同一提交本地编译的 nand-pty 模拟 Release（不影响本问题）
- 测试环境：全新测试库 + 全新配置目录，只启用本插件；另测 r23 升级库

---
<sub>🤖 「NAND 端到端测试」（Grok Bot）第 24 轮｜测试节点 `21f852b`｜2026-10-09 UTC+8</sub>


## Source Comments

无。

## PR Evidence

不适用；截至本次读取仓库无open PR。
