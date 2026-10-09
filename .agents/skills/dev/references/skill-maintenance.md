# 让技能保持准确

只有在你改变了某条不变量，或正在编辑 `dev` 或 `ui` 技能本身时，才打开这个文件。以代码、`package.json` 和 `.github/workflows` 为准。然后在同一次变更里更新下表中负责该事实的那份文件。

## 一个事实，一份文件

| 事实 | 负责方 |
|---|---|
| 显示名称、插件 id、视图类型、模块 id、`minAppVersion`、`isDesktopOnly`、许可证、入口、样式表、辅助程序 | `SKILL.md` 的身份表 |
| 适用于每次修改的规则，以及完成之前的检查 | `SKILL.md` |
| 分区、导入矩阵、懒加载规则、模块系统概览、工作台组合、命令的归属、持久化名称、TypeScript 设置 | `references/architecture.md` |
| 模块文件、添加模块、页面、设置页、服务和贡献 | `references/module-authoring.md` |
| 设置存储、模式、范围、词典、语言行为 | `references/settings-and-i18n.md` |
| Obsidian API、lint 严重程度、DOM、CSS 规则、计时器 | `references/obsidian-api.md` |
| 评论旁路文件、锚点、评论测试 | `references/editor-comments.md` |
| 测试分层、该跑哪个测试、黄金样本、真实 Obsidian 探针 | `references/testing.md` |
| 脚本、样式构建、esbuild、预算、CI、升版本、当前版本、发版流程 | `references/build-and-release.md` |
| 许可文件、依赖、改编外部代码、终端的参考来源、相似度检查 | `references/licensing.md` |
| 工作台 shell 行为、页面与面板契约、对话框 | `../ui/SKILL.md` 和 `../ui/references/shell.md` |
| 设计令牌、原语、模式、CSS 限定范围 | `../ui/references/design-system.md` |
| 主题样式、Markdown 样式、外观设置 | `../ui/references/theme.md` |
| 动效、键盘与无障碍规则 | `../ui/references/motion-a11y.md` |
| 这份地图，以及怎样修订技能 | 本文件 |

指向负责方，不要把值复制到第二份文件里。`SKILL.md` 直接链接每一份参考文件。同级文件可以提到 `SKILL.md` 已经链接的另一份参考文件；不要新增只能经由这一跳到达的文件。

## 只有中文

`.agents/skills` 只有中文。`SKILL.md` 带 frontmatter，工具加载它；`references/*.md` 在某一步被点名时再读。不另存英文版，也不写语言切换行。使用指南和仓库入口文档仍是双语，规则在 `SKILL.md`。

## 怎样修订

1. 在发明新的版式之前，先读宿主的技能规则和公开的 Agent Skills 实践。描述负责触发技能，正文是每次运行都要走的流程，较长的材料放在 `references/` 里，等某一步点名时再读。
2. 列出你将要写的论断：路径、命令 id、页面 id、脚本、检查项。
3. 对照当前源码逐条核对。与导入关系不一致的文件注释不是事实来源。
4. 整理结果。错误的论断替换掉；过于具体的论断放宽到真实的边界；重复的论断删掉多余的副本；智能体本来就会遵守的通用建议删掉；智能体不被告知就会犯的错，在 `SKILL.md` 里留一句话，流程放在负责方文件里。
5. 描述现在的事实，用现在时。技能不是变更记录：不要写更早的状态、版本沿革和迁移说明。
6. `SKILL.md` 保持在 500 行以内。链接只深入一层。
7. 描述要具体，用第三人称，不超过 1024 个字符，并包含用户实际会输入的词：NAND、nand、看板、仪表盘、评论、终端、设置、发版、Obsidian 插件，以及英文的领域名称。
8. 对照上表重读差异。新的版本号、目录或命令行只属于负责方。
9. 打开技能点名的每个路径，并把它点名的每个脚本对到 `package.json` 来检查技能。不要另加技能检查工具。`pnpm test:docs` 会检查链接。

不要在这个技能里添加 `README.md`、`CHANGELOG.md` 或其他编号的杂项文件。
