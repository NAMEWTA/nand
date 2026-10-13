NAND 0.0.1-alpha.2 预发布版。需要 Obsidian 1.13.0 或更高版本。

- 全部NAND管理数据归集到当前vault/.nand，包括受管Markdown、设备身份、浏览器会话/下载/桥接、CLI账号/HOME/Hook及版本化helper。
- 修复JSON编辑基线、外部新增/修改/删除保留与故障恢复；隐藏内容支持工作台编辑、索引、搜索、附件和链接。
- 默认及中文/标点账号使用稳定库内身份；旧账号与会话冷迁移、明确绑定、来源保留；恢复环境与内部链接校验，helper官方摘要及本机保护回执。
- 修复autostash冲突零退出误判，统一回执/通知/自动失败暂停，修复冷重启页面可用性及Hook改名竞态。
- Release依赖同一SHA的完整质量检查及五平台helper；恢复已验证helper的POSIX执行权限。
- 项目指南与开发技能采用中文，根README保持双语；原始许可和历史保留。永久ADR/context的中文候选将在A网关确认后归并。真实认证与未实测平台据实列出，允许跨设备重新认证。

安装：将本 Release 的 main.js、manifest.json、styles.css 放入 .obsidian/plugins/nand/，重启 Obsidian。终端辅助程序会从本 Release 下载并校验，保存在当前 vault 的 .nand/helpers/。旧运行目录迁移可能要求完整重启；迁移会保留经过校验的恢复副本。

CLI 与站点的真实账号认证未验证；Windows/macOS Obsidian 宿主未实测，不据此承诺跨设备保持登录。完整 CI 和五平台 helper 构建回执见本标签工作流。

本版本包含 AI 辅助实现与审查。

发行验证：三环境完整检查及五平台helper构建/stdio检查通过；18项正式资产摘要、插件与标签字节、ZIP内容一致。Linux Obsidian真实下载新装13/13、旧helper升级15/15；已验证终端交互、冷重启、旧文件保留、执行位恢复及无继承宿主句柄。

源提交：[9c0bd5c](https://github.com/NAMEWTA/nand/commit/9c0bd5c0c926e8d75b50e6587db37cc03240db71)；[发行工作流](https://github.com/NAMEWTA/nand/actions/runs/38370493282)。
