# 串行实施检查点

2026-09-28：用户授权按总控完整实施；沿用 current/main、唯一 writer，无子代理，无远程写入。上一规划阶段留下可复验诊断和计划，属于进展；本轮基于当前状态重验。

- #37/T-01：本地 0.0.2 候选与发布 gate 已实现并验证，见 ../../2026-09-28-issue-37-terminal-release/evidence/T-01.md。未完成五平台 CI、公开发布及公开下载 GUI 验收，不标 done。该票暂交还共享文件，后续独立票串行继续。
- #38/T-01：代码与单元/行为测试已实现，提交 f18b06a（parent e7c59b2）；Obsidian 1.13.7 真实控件、预检、正常合成运行和进程重启验收已通过；本票 done。详见 ../../2026-09-28-issue-38-agent-preflight/evidence/T-01.md。
- #39/T-01：路径解析、稳定 ID 聚焦、来源错误与收件箱焦点已实现；c324543（parent 5356993），真实 Obsidian 中英、102 个部件、窄屏、重启/模块生命周期通过，见 ../../2026-09-28-issue-39-widget-source/evidence/T-01.md。
- #30/T-01：a56c441（parent dd4b9f4），命令即时语言刷新、回调/快捷键保持、42 个原生命令不重复、重启已通过。
- #30/T-02：ce50587（parent c12c44a），六叶子/窗口标题、两个 PTY 与组件状态保持、模块关闭、重启与延迟加载通过；#30 全部合同完成。
- 下一票 #32/T-01：产品文案与内部术语清理。
- 其余 11 票尚未实施，36 条 AC 聚合验收尚未完成。

原计划中的 plan-only 授权是历史快照；本次本地实现/测试/必要提交由用户明确要求支持。公开发布在具体候选可审阅后处理，issue 写回不在当前任务内。

宿主环境：Xvfb :97（初始 exec session 40402），Obsidian CDP http://127.0.0.1:9228（最新重启 exec session 92431）。profile/vault/helper 在 /tmp/nand-obsidian-e2e；复用前必须查询实际进程/CDP，不靠此文件认定仍活跃。初始化与脚本副本见 #38/evidence/implementation。
