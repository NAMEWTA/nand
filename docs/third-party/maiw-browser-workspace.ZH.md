[English](maiw-browser-workspace.md) | 简体中文

# MAIW 浏览器工作区参考

| v3 字段 | NAND 映射和导出边界 |
| --- | --- |
| session ID、标题、时间、置顶和工作区面板 | 本地任务 ID 加原始来源 ID／指纹；标题和置顶可编辑。原始布局和官方面板网址保留在来源元数据中用于 v3 导出，不推断本地账号。 |
| turn ID、父 session、序号、prompt 和可选 question | 本地轮次身份及任务关联；保留原始序号、question 是否存在和组合提示词。 |
| 已应用模板 ID／name／content／order | 冻结轮次快照加原始 ID／顺序，不创建独立模板库或上游版本号。 |
| exchange ID、父记录、panel／provider 和 target index | 本地答案及历史目标关联，包括当前工作区已移除的面板。 |
| 答案纯文本／Markdown、状态、时间和采集元数据 | 独立的导入正文段落及来源元数据，不创建原生回执、已核验采集或官网身份。 |
| NAND 原生记录导出 | 按所选任务和当前答案投影支持的 v3 字段；不支持的状态、运行数据和早期采集版本不进入该格式。 |

历史迁移参考固定提交的 `src/db/history-transfer.ts`、`database.ts`、`session-service.ts` 及 history-transfer 测试，对应 NAND 的 `core/workspace/maiw-format.ts`、`history-transfer.ts`、`imported.ts` 和测试。`scripts/generate-maiw-history-fixture.mjs` 在确定性的内存数据库记录上执行上游真实导出函数生成样本，不代表从扩展 UI 或真实账号导出。NAND 增加来源指纹、显式冲突预览、Markdown 持久化和独立的导入正文来源标记；导入的完成状态不会变成已核验采集。v3 缺少完整采集快照、独立模板库和模板版本号；每站只允许一个当前面板，限制见[迁移指南](../browser.ZH.md#ai-工作台)。未知字段和不支持的关联会在写入前被拒绝；无法表达的内容会拒绝导出，不截断。

`core/providers/quality.ts` 参考固定上游 `src/core/acquisition/quality-gate.ts` 的空内容／仅标题／仅状态分类，不用文本长度推断完整性。已确认标题来自受支持历史响应的有界投影，分支和终态证据仍需分别满足。答案比较固定到明确且不可变的采集版本 ID，遵循上游 `src/db/acquisition-snapshot-service.ts` 记录的最新局部结果原则。NAND 使用既有 Markdown 存储，不引入 Dexie 或扩展运行时 hook。

NAND 的 DeepSeek、Kimi、ChatGPT、Claude 和 Qwen 历史解析改编自 [MAIW](https://github.com/NAMEWTA/multi-ai-browser-extension/tree/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800)，固定提交为 `b6b83ca90f0f67fbf25a676e7a8f6b8b34327800`。上游采用 MIT 许可证，Copyright (c) 2026 NAMEWTA。仓库保留其[许可证](maiw-LICENSE.txt)，并在 [NOTICE](../../NOTICE) 中署名。

| 上游来源 | NAND 实现 | 范围 |
| --- | --- | --- |
| `src/providers/deepseek/acquisition.ts` 及其 legacy/fragment 样本 | `src/modules/browser/core/providers/deepseek-history.ts` | 历史响应封装、公开提问/回答片段、稳定消息 ID 和父链遍历 |
| `src/providers/deepseek/runtime-acquisition.ts` | 同一解析器的接口允许列表 | 精确 DeepSeek 来源、历史接口和会话参数 |
| `src/providers/deepseek/selectors.ts`、`strategy.ts` 和 `native-copy.ts` | `src/modules/browser/platform/desktop/deepseek-dom.ts` | 输入、发送、新会话选择器，共用发送/停止控件识别，以及局部答案 DOM 的排除规则 |

Kimi 还将同一固定上游的 `src/providers/kimi/acquisition.ts`、`runtime-acquisition.ts` 和两个 list-messages 样本映射到 `src/modules/browser/core/providers/kimi-history.ts`，将选择器和局部内容排除规则映射到 `platform/desktop/kimi-dom.ts`。允许列表内的 POST 请求体只投影会话身份和分页游标；分页串联已观察的请求，不重放请求。

NAND 拒绝缺失或重复的消息 ID，不用数组位置虚构身份。解析保留重复的正文片段，排除思考、工具和状态片段，检查声明的会话身份，并为分支或分页证据不足保留明确原因。解析历史响应并不能证明答案已经生成完毕。Kimi 要求明确的终态值，不把以“unfinished”结尾的状态当作完成证据。

ChatGPT 以固定上游的 `src/providers/chatgpt/acquisition.ts`、当前分支测试、`runtime-acquisition.ts`、`selectors.ts` 和 `native-copy.ts` 作为 `core/providers/chatgpt-history.ts` 与 `platform/desktop/chatgpt-dom.ts` 的参考。mapping/current-node 结构提供明确父链，只投影该分支的公开消息。NAND 还要求终态和回合结束证据，保留重复片段并排除非公开频道，不将带序号的轮次容器当作消息身份。

Claude 将固定上游的 `src/providers/claude/acquisition.ts`、`runtime-acquisition.ts`、`selectors.ts` 和 `native-copy.ts` 映射到 `core/providers/claude-history.ts` 与 `platform/desktop/claude-dom.ts`。NAND 保留重复公开文本，要求明确的父消息关系、当前分支末端和回合结束证据，不仅凭最后一条是助手消息就判定完整。角色标签和数组位置不作为消息 ID。证据不足时保持不完整；本地样本不证明当前私有网站响应格式可用。

Qwen 将固定上游的 `src/providers/qwen/acquisition.ts`、detail/alternate/partial 样本、`runtime-acquisition.ts`、`selectors.ts`、`strategy.ts` 和 `native-copy.ts` 映射到 `core/providers/qwen-history.ts` 与 `platform/desktop/qwen-dom.ts`。NAND 保留重复片段，对含糊的渐进前缀报告不确定性，不选择最长文本。缺失父消息字段不能证明对话开头；要求明确的分页、当前分支和终态证据。输入框选择排除会话搜索和验证控件；空 Slate 占位内容和未启用的验证容器不作为草稿或验证拦截证据。

豆包将固定上游的 `src/providers/doubao/acquisition.ts`、两份 chain-page 样本、`runtime-acquisition.ts`、`selectors.ts`、`strategy.ts` 和 `native-copy.ts` 映射到 `core/providers/doubao-history.ts` 与 `platform/desktop/doubao-dom.ts`。NAND 只串联已观察到的分页游标，保留重复公开内容，要求稳定消息 ID、明确根节点和终态。分页结束本身不能证明父链或生成结束；不补造身份、不选择冲突答案中最长的一份，也不重放请求。原始参考样本缺少根节点与终态证据，在此合同下保持不完整。

`platform/desktop/provider-responses.ts` 中的被动响应观察器为 NAND 编写。每个任务拥有自己的观察生命周期，复用现有网页操作队列，只保留投影后的消息数据，并丢弃取消或网页实例更换后的迟到结果。它不重放凭据，也不独立请求网站接口。

扣子将固定上游的 `definition.ts`、`selectors.ts`、`strategy.ts`、`native-copy.ts` 及局部复制测试映射到 `platform/desktop/coze-dom.ts`、`scoped-chat-dom.ts` 与 `coze-session.ts`。参考实现没有 API 采集适配器。NAND 对该策略不安装响应观察器，每个会话绑定一个确切的官方域名，并要求明确的公开会话、消息和父消息属性。测试 ID 和 DOM 位置不作为消息身份。局部 DOM 与网站复制结果均保持不完整。不补造尚未证实的永久链接；原文定位只使用原先保存的页面实例，并核对消息身份。

MiniMax 对应的六份固定上游文件映射到 `minimax-dom.ts`、共用的 `scoped-chat-dom.ts` 和 `minimax-session.ts`。用户与助手的类名选择器保留站点差异，身份、内容与复制检查使用同一合同。该参考同样没有 API 策略。允许列表还包括 `agent.minimax.cn`：2026 年 10 月 11 日打开官方 `chat.minimax.io` 入口时观察到该跳转目标。公开跳转只证明入口，不证明登录后页面结构或永久链接兼容性。

固定上游的 `src/entrypoints/native-copy-main.content.ts` 与 `src/runtime/native-copy-client.ts` 用于复制边界审查。NAND 的 `platform/desktop/provider-copy.ts` 限定同步派发：一个明确的公开答案控件、无瞬时用户激活、有界 Clipboard 内容、阻止旧式 copy/cut，并恢复临时修改的方法。生产 guest 权限拒绝迟到的现代剪贴板写入。复制内容必须匹配已加载答案全文，但完整覆盖范围仍未验证，结果保持不完整。不通过读取系统剪贴板来取得答案。

DOM 读取要求明确的消息 ID，不按显示顺序虚构父消息 ID。它最多读取 200 个消息根节点，触及此上限或明确被截断时标为局部结果。局部 HTML 保留标题、表格、代码，并从 KaTeX 注释保留公式的 TeX 源文。思考、工具、状态区域和交互控件会被排除。内部原生输入复用现有网页队列，在派发前重新检查站点条件和实际点击位置。

已注册的任务服务、原生 DeepSeek/Kimi/ChatGPT/Claude/Qwen/Doubao 会话和[任务界面](../browser.ZH.md#ai-工作台)已在生产构建中接通。本地 Electron 样本验证了六站各三轮连续发送、Kimi 与豆包分页、当前分支隔离、未完成状态边界、Markdown 保存、重复问题的独立回执、重启后不重发、模块释放和响应式布局。千问检查还覆盖 Slate 草稿保护和站点名称翻译。验证时 HTTPS 流量均由本地提供。真实账号兼容性与验收仍未验证；这些样本无法证明当前官网的私有响应或 DOM 合同。
