# 浏览器快捷键修复与多 AI 工作台、受限网页助手领域语义

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 21 票、40 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

**provider**：八个站点标识 deepseek/kimi/chatgpt/claude/qwen/doubao/coze/minimax；官网账号与终端 agent provider 不同。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**profile**：vault/device 下显式浏览器登录环境；default 维持现有分区，isolated 是独立 Electron partition；UI 显示用户自定账号标签，不猜真实身份。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**target**：一次可选发送目的地，以 providerId + profileId + pageId + conversation 绑定区分；同站不同账号可同时作为不同 target。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**task / turn / exchange**：task 为本地用户任务；turn 为一次明确提交的问题与模板快照；exchange 为该轮一个 target 的发送与回答结果。task 不等于官网会话。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**attempt**：一次明确发送意图的稳定 UUID；持久记录先于远端 mutation。重采集与保存重试不产生 submit attempt；用户明确重发才建新 attempt。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**capture**：一次采集快照，记录来源/adapter version/消息身份/完整性；单一来源，修订单调递增，不拼接多个来源。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**PoC Gate**：真实 Obsidian 内三站源码闭环验收；证据区分源码事实、fixture、真实登录运行。没有账号/失败站点写明未通过，不能拿研究报告替代可执行实现。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**ownership**：page 的执行权，owner 为 deterministic turn、assistant、workflow、external 或 human；排队时固定目标，执行时重验 identity/epoch，暂停后不准派发新 mutation。
_Avoid_: 将该词用作其它模块的持久化或调度权威。
