已发布新版本 [0.0.1-alpha.2](https://github.com/NAMEWTA/nand/releases/tag/0.0.1-alpha.2)，不可变标签对应 [9c0bd5c](https://github.com/NAMEWTA/nand/commit/9c0bd5c0c926e8d75b50e6587db37cc03240db71)，没有复用或移动 alpha.1 标签。

[发行工作流](https://github.com/NAMEWTA/nand/actions/runs/38370493282) 的三环境完整检查、五平台 helper 构建与 stdio 验证全部通过。已实际下载全部 18 个资产，校验 SHA256SUMS 和五个 helper 摘要；插件三文件、许可证与 ZIP 内文件等于标签中的字节。GitHub 来源证明中的资产摘要、源 SHA 和工作流编号一致。

Linux Obsidian 用正式下载资产验收：新装 13/13、携带 alpha.1 旧 helper 的升级 15/15。新 helper 按 alpha.2 下载到 vault/.nand/helpers 的独立版本路径，旧文件保留为恢复副本。真实 shell 输入输出及重启通过；历史扫描结束后 helper 仅持有 0/1/2 三个标准句柄，丢失执行位后仍恢复到 0700 且字节不变。

真实账号认证与当前 Windows/macOS Obsidian 宿主未实测。本说明使用 AI 辅助整理；本机未独立验证来源证明的密码学签名。
