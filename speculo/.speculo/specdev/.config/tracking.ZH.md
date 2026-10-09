[English](tracking.md) | 简体中文

# 变更追踪

SpecDev 只用本地 Markdown 和 JSON 工件追踪开发。远程 issue、URL 或其他来源，必须先由 triage 冻结为 `changes/<change>/source.md`。远程状态、标签、负责人和依赖不会替代本地的 change、ticket、map、goal plan 或证据。

- change 根目录是 `speculo/.speculo/specdev/changes/`。一个 change 位于 `changes/<YYYY-MM-DD>-<kebab-topic>/`。
- 一个 change 是一个可以独立说明、实现、验证和归档的目标。
- `status.json` 是活动 change 的全局索引，`changes/<change>/.status.json` 是单个 change 的生命周期。索引恰好列出 `changes/` 下的目录。
- ticket 文件是其状态的权威，`tickets-map.md` 是 ticket 文件的同步投影。入口状态、ticket 状态和 map 状态在同一次操作中更新。
- 完成条件：所有必需的 ticket 为 `done` 或有批准的 `cancelled`，证据齐全，没有未批准的偏差，change 级验证通过。
- 已完成 change 的结论进入 ADR、context 文档和用户指南。`archive/<YYYY-MM>/<change>/` 写入后只读，之后的纠正通过新的 change 完成。
- 可关闭的远程来源在本地工作完成后由 triage 对账。把 ticket 发布到远程跟踪器的记录写入 `changes/<change>/publish.md`。尚未立项的记事写入 `capture.md`，不创建 change。远程 issue 永远不是开发权威。
- 每次交付说明来源基线、覆盖的文件、实际运行的检查和未验证项。未验证项不能通过修改记录变成已通过。
