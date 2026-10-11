# NAND 私有目录和文件的最小POSIX权限领域语义

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 2 票、6 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

**私有运行数据**：库内.nand拥有的数据；普通Markdown笔记不在此权限策略内。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**权限修复**：只调整插件管理路径的POSIX mode，不是加密、擦除Git历史或内容迁移。
_Avoid_: 将该词用作其它模块的持久化或调度权威。
