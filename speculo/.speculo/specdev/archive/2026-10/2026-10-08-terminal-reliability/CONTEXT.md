# 终端 helper 可安装性、错误反馈与句柄隔离领域语义

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 2 票、5 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

**helper资产**：与插件版本一致的nand-pty平台二进制及独立SHA256。
_Avoid_: 将该词用作其它模块的持久化或调度权威。

**继承句柄**：helper启动前从父进程传入的非stdio描述符；不同于它自身创建的PTY/epoll。
_Avoid_: 将该词用作其它模块的持久化或调度权威。
