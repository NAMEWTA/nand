# NAND

NAND 是 NAMEWTA 的通用 Obsidian 工作台。看板、编辑器和桌面端编程智能体分成独立模块，在设置首页里分别打开或关闭。关掉的模块不会启动。

手机端可以使用看板和编辑器。终端和编程智能体只在桌面端启动。

插件 id 是 `nand`。界面和持久化标识按产品域统一命名。旧库升级前需使用独立迁移工具，转换评论目录、固定标签页和界面状态；详见 [数据升级步骤](docs/namespace-upgrade.md)。

## 安装

1. 从 [GitHub Releases](https://github.com/NAMEWTA/nand/releases) 下载发布包。
2. 把其中的 `nand` 文件夹放进库的 `.obsidian/plugins/`。
3. 在设置的第三方插件里启用 NAND。

以前装过旧 id 的库需要重新安装这份插件。设置不会自动迁到新目录。

功能区的首页图标打开设置首页。

评论的删除操作位于卡片右下角的“更多”菜单。Agent 设置按 CLI 路径、权限模式和额外参数分行显示；看板主题与已有配置保持兼容。

此前的界面调整见 [UI 验证记录](docs/ui-review-2026-09-26.md)。最新问题修复及验证范围见 [Issue 修复记录](docs/issue-fixes-2026-09-27.md)。

## 资金参考

看板参考了 [PandoraReads/apex-dashboard](https://github.com/PandoraReads/apex-dashboard)（MIT）。终端参考了 [ZyphrZero/Termy](https://github.com/ZyphrZero/Termy)（GPL-3.0）。智能体启动与用量参考了 [stablyai/orca](https://github.com/stablyai/orca)（MIT）。感谢这些项目。
