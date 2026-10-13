已在 [0.0.1-alpha.2](https://github.com/NAMEWTA/nand/releases/tag/0.0.1-alpha.2) 完成整改，产品源提交为 [9c0bd5c](https://github.com/NAMEWTA/nand/commit/9c0bd5c0c926e8d75b50e6587db37cc03240db71)。

- R01/R03：保存保留外部更新、删除与新增；恢复点覆盖最近有效磁盘状态，连续保存、排队编辑和故障重试有回归，并覆盖实际设置接线。
- R02/R05：默认、中文和标点账号采用稳定库内身份，HOME/凭据/Hook/会话位于 vault/.nand；碰撞旧目录明确绑定，保留恢复来源，校验 POSIX 权限及 Windows ACL。
- R04：检查 autostash 后未合并状态，冲突回执、通知及自动暂停保持一致；真实 Git 与 Linux Obsidian 同步验收通过。
- R07：Release 依赖相同 SHA 的完整三环境检查和五平台 helper；[正式工作流](https://github.com/NAMEWTA/nand/actions/runs/38370493282) 全部通过。18 个下载资产摘要及插件/ZIP字节核对通过。

本地完整回归 50/50，1826 项测试通过、1 项跳过；Linux 浏览器宿主 36/36、正式资产新装 13/13、旧 helper 升级 15/15。已核对重启、执行位恢复和无继承宿主句柄。

真实账号认证、当前 Windows/macOS Obsidian 宿主仍未实测；CI 和五平台 helper 测试不代表这些场景已验收。用户已取消 Windows 专属宿主门。关联发行问题 #148 一并由 alpha.2 交付解决。

本整改与此完成说明使用 AI 辅助实现、测试和审查。
