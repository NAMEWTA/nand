# Git 同步对照补齐、仓库边界与失败恢复领域语义

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 4 票、11 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

**暂存优先提交**：smart模式只提交已有暂存；空暂存是否stage all由设置决定。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**同步运行**：commit/pull/push各有独立结果；部分失败不等于同步成功。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**管理范围**：配置允许的vault或其内部repo范围；父repo的其它路径不归NAND提交。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**实际推送目标**：push remote/ref及其固定对象，与pull upstream可能不同。
_Avoid_: 将该词用作其它模块的持久化或调度权威。
