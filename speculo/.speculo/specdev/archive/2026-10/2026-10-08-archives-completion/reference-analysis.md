本工件由G拥有，记录实际研究证据。研究过程中的建议以本change最终ADR与Spec为准；例如新闻后段功能全部保留、首页三项日期/主题/直发语义、浏览器五阶段及数据边界均已由用户明确确认。文件路径是导航，不是源码移植授权。临时研究检出不作为恢复依赖，恢复须按固定SHA/公开URL读取。

# 档案、Git、回归与存储核验

本报告由 G 作为规划事实输入；基线 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。只读检查不等于真实 Obsidian 验收。独立探索遵循 research Skill，目标为各 change 的 reference-analysis，而非永久知识。

## 档案 #124

完整阅读 issue 正文及全部可见评论（0）。当前实际落点是 src/modules/archives，旧 src/core/contacts、src/view/contacts 已迁移。search-text.ts 已实现 buildSearchDocument、searchTerms、documentMatches、searchHit；index-store.ts 以路径为索引键，维护关联依赖并在更新前保留受影响集合。panel-state、contacts-presentation 和 surface 已有列表/卡片、按类型偏好、摘要与原笔记定位。该 issue 的主要功能已经存在，本 change 以完成差异核销、真实宿主与规模验收及有证据的小修为目标，不重做索引或文件格式。

官方 Bases 文档 https://obsidian.md/help/bases 核实同一 Markdown/属性数据可有多布局，Properties https://obsidian.md/help/properties 核实属性适合原子信息、长 Markdown 留正文。Monica https://github.com/monicahq/monica/issues/1687 是合并需求讨论，不证明同邮箱即同人；Twenty https://github.com/twentyhq/twenty/issues/4985 是多联系方式需求，不要求主邮箱迁移。X 两条公开贴作为历史动机而非必要技术依赖，不采用其热度数值；未读取私有回复，不宣称完整讨论。

实际保留：person 新页 list、company 新页 cards，已有 workspace 缺字段 cards；空格分词 AND、中文子串、英文忽略大小写；组内OR组间AND；名称/修改时间排序；emails 非身份；entry note 全文不含附件。需要核销旧状态、IME、滚动锚点、部分读失败、关联改名和重复 ID 恢复、元数据标记排除、自由正文定位不确定时不编造行号、100/1000/5000规模报告。运行 pnpm exec vitest run src/modules/archives/archives.test.ts 等共6套，91 tests通过；这些不能替代宿主截图、性能或移动验证。

## Git #134：固定 wta 提交对照

参考 https://github.com/NAMEWTA/obsidian-git-zh/tree/bde2d06edf2cac28f90cba796afc51bdbf73f160 ，完整检出；LICENSE MIT (2020 Vinzent03, Denis Olehov)。NAND 已有 NOTICE 注明参考，但本次应补固定 fork wta 版本与文件映射。

| 参考能力 | 参考文件/调用链（该SHA） | NAND 当前落点 | 差异/剩余交付 | 验证 |
|---|---|---|---|---|
| 命令与初始化 | commands.ts → main.ts.isAllInitialized / commitAndSync | sync/module.ts、services/sync-service.ts、core/flow.ts | 已实现手动核心；补 clone 向导（只到用户选择的新空目录，不能覆盖当前库） | 空目录/非空/无Git/无upstream；bare remote |
| 暂存优先 | main.ts.resolveCommitMode → commit → gitManager.commit | core/commit-mode.ts、flow.ts | smart/staged/all 已有，保留选择；库位于父repo时全局index与范围隔离需补核验 | vault外预暂存哨兵不得进提交；原index仍保留 |
| 一键同步 | main.ts.commitAndSync | core/flow.ts.commitAndSync | upstream失败后NAND停止push，比参考显式安全；不采用reset模式 | pull失败不push、部分成功逐步可见 |
| Git abstraction | gitManager/gitManager.ts / simpleGit.ts / isomorphicGit.ts | core/ports.ts + platform/desktop/git-runner.ts | 系统Git桌面；不引入isomorphic-git移动端；runner限时并关闭prompt | 实Git、credential/SSH宿主矩阵 |
| 自动同步 | automaticsManager.ts + promiseQueue.ts | services/automatics.ts、core/queue.ts、schedule.ts | 时间/编辑防抖/启动pull/独立push/pause已有；参考队列finally继续，NAND拒绝卸载残留任务 | 短会话时钟、手动自动竞争、卸载取消 |
| 设置本机状态 | setting/、types.ts + localStorage | settings.ts、platform/desktop/host.ts | namespaces，路径device作用域；时钟在.git/nand-sync.json | 重载、vault切换、不泄露凭据 |
| 状态与差异历史 | ui/sourceControl、ui/diff、ui/history、statusBar.ts | ui/sync-presentation.tsx、services/workbench.ts | 保留三栏native宿主与Preact，不引入Svelte或新增view type | 分组、变更/暂存数、history/diff可解释状态 |
| 冲突 | editor/conflicts/{model,actions,view}.ts、ui/modals/mergeConflictModal.ts | core/conflict-blocks.ts、ui/conflict-extension.ts、sync-service.ts | merge/rebase中止/继续，二进制保留手动选择；不静默ours/theirs覆盖 | 两个副本、文本/delete-modify/rename/binary |
| 压缩未推送提交 | main.push → simpleGit.squashAllUnpushedCommits | core/flow.ts.squashUnpushed | 显式默认关闭；参考按pushTarget，NAND目前按upstream：pushRemote不同必须拒绝压缩或按真实目标验证；NAND已有祖先/tag/merge/暂存保护与commit失败soft-reset恢复 | staged不变、tag/merge/远端漂移、commit hook拒绝、push目标不同 |
| 认证与中文 | docs/Authentication.md、docs/Features.md、src/i18n | i18n.ts、docs/sync双语 | SSH/credential不写配置或日志，真实凭据验证未做不能宣称通过 | 报错脱敏、真实宿主、认证失败保持本地数据 |
| 扩展边界 | submodule、blame、editor line stage/branch/clone | docs/sync现状 | clone是issue明确必需，须补；submodules/blame/hunk/branch管理不列本期必需，保留系统Git行为与逐项说明；reset/force-push不做 | 能力矩阵而非全部声称复现 |

已深读 commitAndSync/resolveCommitMode、queue全体、automatics init/reload/unload/各timer、simpleGit pull/squash、isomorphicGit pull等具体实现。参考的 squash 仅检查staged/merge/计数、随后soft-reset+commit，没有NAND已补的tag引用和异常恢复，不能照抄；main未根据pull结果显式停止push也不照抄。

## 回归事实

#135：当前 manifest 与 package/native 版本变为0.0.1-alpha.1且API已存在此Release，旧1.0.0缺失背景已过时；ensureHelper仍同版本URL+sha256下载，BinaryError.http虽message含URL/status，调用方文案仍可吞信息。保留修复票处理404与网络分别反馈、结构化且脱敏诊断、资产矩阵校验。实际fresh安装下载验收待实施时完成，不能用NAND_PTY_BINARY覆盖验收。

#138：shell.css scrim absolute inset0覆盖rail，Shell.tsx点击只setOverlay(false)。medium rail必须在可操作范围，同时保留narrow模态焦点管理；只改z-index不足以证明键盘可用。

#139：app/settings/home.ts添加模块图标，CSS前置order依赖.nand-home-settings祖先；必须统一工作台/原生设置容器语义或选择器。32px图标方块、名称左侧、开关可访问，不能额外重排产品。

#140：ui/primitives/localized-dom.ts bindLocalizedOptions仅更新select.options；refreshLocalizedDom更新文字而未通知原生Dropdown重测。绑定原生control生命周期并重建/刷新选项与测量，保持value、不触发onChange保存，不能硬编码宽度或访问隐藏私有select结构。

#141：home归属单独优先修复，详见home研究。

#142：browser归属单独优先修复，详见browser研究。

#143：native/pty-server/main.rs先建job、mpsc和线程；尚无继承FD清理。Unix清理必须在创建任何helper自身资源/线程前，保留0/1/2，优先有明确平台实现而非多重静默fallback；Linux老内核/macOS有限可验证路径，Windows不套POSIX。验收检查已继承哨兵/真实Chromium资源不在helper中，helper自建PTMX/epoll允许；shell仍只持合法terminal句柄。

#144：shared/durable-state + host/obsidian/storage/document-collection 使用adapter.mkdir/write无POSIX mode。权限能力落host/desktop适配，shared仅声明端口，不能在shared导入fs；native历史SQLite和其sidecar亦在覆盖范围。升级一次收紧.nand根与插件管理的目录/文件，跳过symlink且禁止根外递归；新创建目录0700、文件0600。Windows/mobile跳过，chmod失败非致命且可观测，不得修改普通笔记、恢复宽权限或宣称加密/Git抹除历史。

## 本次最终核对

重新读取GitHub仍为原13个open issue，updated_at无漂移。上述研究中候选票数/未决偏好为探索轨迹；最终权威为当前Spec与61票整体清单，用户已明确确认全部G设计分支。权限writer覆盖及每级symlink；Git库外unstage-all与实际push target；档案准确字节规模工具；终端五平台资产验证；HOME_WIDGETS每模块provider bundle；dispatch交付与prompt结果严格分离；自动化typed workflow装配、编辑器和receipt；browser内部scope与短期runContext env仅最终spawn合并、不进入accountKey；浏览器manifest和真正UI入口；永久ADR保持只读；站点/历史等虚假串行依赖已移除。
