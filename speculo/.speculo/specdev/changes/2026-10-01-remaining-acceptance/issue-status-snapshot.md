# Issue 状态复核：原计划范围与当前开放列表

核查日期：2026-10-04。main 仍为 `3cf0c32c78b1eadfdd51cee306246d111dbbe4a3`。这是执行原 T01/T33 时读取到的状态变化，不是另行改写原 T01–T33 范围。

## 当前状态

| 集合 | Issue | 含义 |
|---|---|---|
| 原批准计划的九项 | #97、#98、#99、#106、#107、#109、#110、#111、#112 | 本 PR 的验收改进来源，不等于当前开放数量 |
| 原计划仍开放 | #97、#98、#99 | 未在本轮关闭 |
| 原计划已独立复测并关闭 | #106、#107、#109、#110、#111、#112 | 测试报告已追加到各 Issue，非本轮实现者的原生执行或关单 |
| 新增且仍开放 | #117、#118、#119、#120、#121 | 原批准计划未覆盖，本 PR 不声称修复 |
| 当前全部开放 | #97、#98、#99、#117、#118、#119、#120、#121 | 共 8 项，排除 PR |

查询：[开放 Issue](https://github.com/NAMEWTA/nand/issues?q=is%3Aissue+is%3Aopen)。后续提交前仍需重新读取，不能把本文件当作动态状态服务。

## 独立复测证据及边界

以下报告均针对 main `3cf0c32...` 的本地插件构建，Linux Obsidian 1.13.7，使用 Release 0.0.1-alpha1 的服务。它们不是本 PR 分支的实机记录，不据此声称 Windows/macOS GUI、最低版本或全新插件 Release 安装全部完成。

| Issue | 已读取的原报告 | 支持的结论与未覆盖边界 |
|---|---|---|
| #106 | [复测与关闭记录](https://github.com/NAMEWTA/nand/issues/106#issuecomment-5978458660) | 默认下载、校验、握手及重新安装 2/2；EACCES 验证提示和同实例恢复。真实 404 未重现，因此不能代替本 PR 的受控 404 用例 |
| #107 | [复测与关闭记录](https://github.com/NAMEWTA/nand/issues/107#issuecomment-5978459374) | 原四个弹窗、另两个同类入口正常；自动化复用会话和上下文素材未测。不得写成七个完整业务保存流程通过 |
| #109 | [复测与关闭记录](https://github.com/NAMEWTA/nand/issues/109#issuecomment-5978460063) | 单层焦点、查找聚焦/Esc 和运行时 ribbon 语言通过；不包含双窗口/IME 全矩阵 |
| #110 | [复测与关闭记录](https://github.com/NAMEWTA/nand/issues/110#issuecomment-5978460704) | Linux 停用、正常退出、崩溃后下次桥接恢复、卸载与普通 shell 变量数 0；没有真实 Agent 0/4/0 完整链路 |
| #111 | [复测与关闭记录](https://github.com/NAMEWTA/nand/issues/111#issuecomment-5978461377) | 两组件成功态不再常驻；未报告完整原生故障/冲突/重试矩阵 |
| #112 | [复测与关闭记录](https://github.com/NAMEWTA/nand/issues/112#issuecomment-5978462034) | 六次真实 Linux 重启及重新安装保留习惯和打卡；不是十次 Windows 冷启动，也不是外部改动/慢索引全矩阵 |

尊重既有关闭状态，不重开、不重复实施已完成的修复。原计划中较广的未验收范围保留在本 change；不以此否定原报告针对其场景的关闭结论。

## 新增问题：仅登记，不计入本 PR 完成度

| Issue | 现象（来自原报告） | 本轮处理 |
|---|---|---|
| [#117](https://github.com/NAMEWTA/nand/issues/117) | 最近编辑被插件 Markdown 存储文件占据 | 已读报告；未修改最近文档过滤 |
| [#118](https://github.com/NAMEWTA/nand/issues/118) | 新库默认示例和设置路径仍有语言混用 | 已读报告；未修改种子或默认路径 |
| [#119](https://github.com/NAMEWTA/nand/issues/119) | 自动化新建待办候选允许备忘等非待办卡片 | 已读报告；未修改候选或执行端验证 |
| [#120](https://github.com/NAMEWTA/nand/issues/120) | 浏览器/看板窄窗格下按钮不可见 | 已读报告；未修改布局 |
| [#121](https://github.com/NAMEWTA/nand/issues/121) | 冲突提示路径错误、未捕获 Promise、后续修改保存风险 | 已读报告；未修改冲突副本或 Promise 链 |

本次只提交原计划内验收基础补丁，不通过关闭新 Issue 或修改其状态制造完成。生产缺陷仍需其对应的定点修复与回归，#119/#121 尤其不能只靠 UI 文案调整算作解决。

## 本 PR 自身测试失败及修正

首个提交 `b2b3a1d7...` 的[标准 CI](https://github.com/NAMEWTA/nand/actions/runs/37197589354)：两项 Linux 作业通过；Windows 的新增验收合同 34/40 通过，六项因混用 `realpath(root)` 与原始候选路径而被错误拒绝。构建、产物一致性和 lint 通过，未跳过失败断言。

后续补丁用相同路径拼写计算相对关系，再用规范化根目录逐段检查 IO；保留目录边界与子路径 symlink/junction 拒绝。增加显式授权别名根目录的复现测试，本地共 41 项通过。Windows 修正是否通过以最终 HEAD 的新一轮 CI 为准；不能把首轮失败删除或写成已通过。
