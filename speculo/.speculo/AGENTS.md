# Speculo runtime guide

从项目根字面路径 `speculo/.speculo/workspace.json` 解析 roots，按需读取同目录生成的 `catalog.md`；发现不激活、不授权。先按当前任务定位相关 workflow、command、skill 或 change，再读取对应入口和分支 reference；不默认整读 `speculo/` 或永久知识索引。

- 被动发现：按关键词/ID 搜索 `speculo/workflows/<workflow>/INDEX.md` 的相关行，只定位与当前请求相关的永久知识条目。
- 激活 workflow：再读取对应 `README.md`、状态投影和当前 Work；只加载当前分支需要的规则、schema、模板与工具。
- 记忆检索：先定位索引 entry，再回读少量原文和 provenance；没有匹配证据时停止猜测。
- 记忆写入：先解析 owner/gateway，检查 pending transaction、lock 和 recovery evidence；网关未知时阻塞该写入并继续独立工作。
- 只读探索、静态编辑和本地测试按用户任务直接进行；提交、推送、发布、部署、远程写入、归档移动、永久知识改写和不可逆操作核对用户授权。已有授权覆盖对象、动作与风险时不重复询问；写入仍由对应 owner/gateway 执行。
- 失败、漂移、schema 冲突、越界路径或 owner 不明时停止受影响分支，保留证据并报告恢复路径。

详细状态、所有权和副作用合同由各 workflow 的 `INDEX.md`、`README.md`、`common/rules/` 和 schema 定义。

修改智能体指令、工作流行为或批量重构文档时，按需读取 `<Path>{roots.skills}/writing-for-agents/references/document-contract.md</Path>`（不自动激活该 Skill）。普通局部文档编辑只核对相关事实、链接和 diff。按风险选择备份与验证，报告实际修改和未验证项；不默认要求字符统计、全仓扫描或插件构建。普通任务的完成标准遵守项目 AGENTS；不为局部修订自动创建 Change。
