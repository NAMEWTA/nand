# 八项 Issue 修复与验收（PR #123）

范围：#97、#98、#99、#117、#118、#119、#120、#121。基于 main `c09ec6d78ad9c8b05edf8e0c47b0aec8ca4701e6`，接续已有 `fix/open-issues-97-121` 分支；五项新问题有实际生产修复，不以验收脚本代替实现。原计划逐项状态见[任务表](../../../changes/2026-10-01-remaining-acceptance/eight-issue-progress.md)，结构化结果见[证据](issue-repairs-evidence.json)。本页为合并前交付快照；最终提交、CI、合并和关单记录由 [PR #123](https://github.com/NAMEWTA/nand/pull/123) 及对应 Issue 保存。

## 实现与原问题

| Issue | 实现及判定依据 |
|---|---|
| #121 | `save-state.ts` 区分原文保存和恢复副本；`SyncEngine` 将首次冲突、已排队和后续修改串行保存不可变修订。失败显式可见，支持重试、复制草稿/路径及确认后重新载入。回调观察拒绝但不改变等待调用者的失败结果。最新副本与第三次编辑一致，外部正文保留，实机未捕获异常为零。 |
| #119 | `card-kind.ts` 共用渲染语义；候选按有效类型和唯一 ID 过滤，保存重查，`Vault.process` 内最终校验。保留 sticky 任务卡、未保存正文保护及 runId 去重。原生表单仅列默认两张待办卡，正常动作成功，伪造备忘目标失败且正文不变。 |
| #117 | 精确排除管理集合、注册看板、档案主文件和格式说明；先过滤再排序截断。桌面、移动抽屉和刷新传入同一作用域；相似文件名和普通档案材料保留，不新增正文扫描。原生创建习惯并写入后侧栏仍列用户笔记。 |
| #118 | 新建时生成双语分区、阅读卡片和 Banner；新默认路径为 `Archive/Done.md`、`Weread/Highlights`，实际回退共用常量。已保存路径和正文不随语言改写；固定属性名以代码样式显示。两种设置渲染在 1.13.7 中实测。 |
| #120 | 原产品 CSS 块局部换行，地址栏与快捷配置按钮可达，不重建 BrowserPage。Linux 真实宿主完成 20 个宽度/语言/主题组合，含 288px、448px 窗格；更多菜单实际可打开，guest 和未提交地址保留。 |
| #98 | 保留现有 App 作用域评论交接。Windows、Linux 各十次创建/删除后立即禁用启用，卡片为零、索引无记录、pending 不残留、正文不变。 |
| #99 | 保留精确占位标题与自定义名称规则。Windows、Linux 均验证六种视图在两个窗口的中英文延迟标题，以及完整正常退出再启动后的恢复；自定义标题保留。 |
| #97 | 保留明确命令 ID 集合和注册对象/回调稳定性测试；完整脚本在候选 CI 运行，不增加无关命令改动。 |

## 产物绑定

生产 `main.js` SHA256：`14e6b47461722813d9062c8e456354d61da117f94320a5fdd6f867cad59c9e93`。对应 Git blob：`2a0edb18b7afe1d68317d000dda86ccb8847dbb5`。样式与 Manifest 哈希在证据 JSON 内。

Windows 原生测试运行 [37207257992](https://github.com/NAMEWTA/nand/actions/runs/37207257992)，源码 `673fb15a4778ad79d7f4c02af274628b1d25c4a9`，使用官方 Obsidian 1.13.7、独立临时 Vault/profile，结果 ZIP 已下载并核对摘要。实际宿主启动两次、正常退出两次；不是 Windows Node CI。

本轮 Linux 原生重跑使用源码归档 `2d18048feda36e94d9ca72b93d798bb61aa70e64` 的生产产物，`issue-fresh-runtime.mjs` 增加 `NAND_ACCEPTANCE_CASE=all` 以及已发信号退出检查后运行。该 harness 随本次提交保存，其哈希在证据中；生产输入与 Windows 实机完全一致。Xvfb 提供显示，真实 Obsidian 进程执行应用逻辑，并正常退出；不是 DOM stub。

## 自动化与前后对照

新增 38 项内容/目标测试及 7 项冲突修订测试，进入既有 `test:safety-regressions`，未增依赖或永久 CI 工作流。对照实验在旧生产源码 `3a09ca8...` 与候选上执行相同公共 API 探针：#117、#118、#119、#121 在旧行为下四项失败，候选四项通过。其中让第一份恢复写入延迟、第二份先完成，旧副本最终为 A，修复后为 B。#120 的旧布局依据原报告，未将其伪称为本轮旧版实机复现。

本地 Node 22.16.0 构建和 lint 通过（0 错误，150 项既有警告）；聚合测试 55/56 脚本通过，唯一失败为已有 `terminal-view-lifecycle.test.ts` 的加载钩子返回 null（`ERR_INVALID_RETURN_PROPERTY_VALUE`）。相同错误在未修复基线独立重现，不修改或跳过该测试。最终合并仍须经过仓库现有 Linux Node 22/24 与 Windows Node 24 的完整 CI；其结果绑定最终 HEAD，不用本地结果替代。

首次 Linux 启动缺少 X display，尚未进入业务测试；随后在专用 Xvfb 中成功重跑。初次实验的 TSX 模块加载和 ESM 打包失败不作为原缺陷证据；改用同一 esbuild CJS 流程后取得上述业务对照结果。

## 可复现入口

已有安装与源码构建按[构建规程](../../../../../../.agents/skills/dev/references/build-and-release.md)执行。在带显示环境的 Linux 或 Windows 主机，从仓库根运行：

```sh
NAND_ALLOW_FRESH_ISSUE_FIXTURE=1 \
NAND_FRESH_FIXTURE_ROOT=/absolute/new-unused-directory \
NAND_OBSIDIAN_EXECUTABLE=/absolute/Obsidian-executable \
NAND_ACCEPTANCE_CASE=all \
node scripts/obsidian-acceptance/issue-fresh-runtime.mjs
```

Windows 用同名环境变量；默认 case 为 `comments`，可选 `all/content/layout/conflict/comments`。入口只创建不存在的新目录，部署三件产物，核对实际 Vault/profile/宿主及产物，最后正常结束自己创建的应用。不得指向日常资料库。临时构建、devkit 和 Windows 运行程序准备工作流在合并前删除；原标准 CI/release 工作流保持不变。

## 未扩大为本轮完成的范围

没有发布新版本、重打标签或更新既有 Release。修复进入 main 不代表旧 `0.0.1-alpha1` 发布包已更新。没有新增 AI 写作、同步实现、历史迁移或双写。

真实 Obsidian 1.12.0、Android/iOS、第三方主题/系统 IME、跨平台长期压力和真实 CLI 账号认证仍按独立待验收清单保留。两种设置界面的实测都在 1.13.7；移动抽屉仅代码接入及相关回归，不冒充手机实机。WeRead 的新默认路径与代码回退已检查，不涉及真实账号联网导入。Linux 本轮冲突实机使用外部写入后立即点击及继续编辑；各种备份/队列交错由确定性测试补足，不宣称重现报告中的每个毫秒间隔。
