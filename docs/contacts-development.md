# 档案开发与验收

面向维护者。用户操作见 [档案使用指南](contacts.md)，字段与 Markdown 协议以 [随插件分发的格式说明](../src/contacts/persist/format-guide.md) 为准。项目边界与生命周期规则见 [架构约定](../.agents/skills/dev/references/architecture.md)，构建与测试规则见 [验证规范](../.agents/skills/dev/references/build-and-release.md)。

## 实现入口

| 位置 | 职责 |
| --- | --- |
| [model.ts](../src/contacts/model.ts) | 人物、企业、任职、关系和日期验证 |
| [persist/markdown.ts](../src/contacts/persist/markdown.ts) | YAML 与正文解析、序列化、字段／区域级三方合并 |
| [persist/format-guide.md](../src/contacts/persist/format-guide.md) | 创建资料时写入用户目录的格式说明；作为文本打包，修改后需要重建 `main.js` |
| [index-store.ts](../src/contacts/index-store.ts) | 内存索引、同名与重复 ID 区分、企业人员统计、反向关系、组合查询 |
| [controller.ts](../src/contacts/controller.ts) | Vault 文件读取和监听、写入队列、增删改、目录切换与失效读取保护 |
| [view/view.tsx](../src/contacts/view/view.tsx) | Obsidian leaf 生命周期、窗口迁移、导航和滚动位置 |
| [view/surface.tsx](../src/contacts/view/surface.tsx) | Preact 卡片、详情、分页及 Markdown 内容展示 |
| [view/forms.ts](../src/contacts/view/forms.ts) | 原生 Modal／Setting 表单、选择器、筛选、草稿和冲突处理 |
| [contacts-settings.ts](../src/plugin/settings/contacts-settings.ts) | NAND 设置页的目录预览、应用与列数选择 |
| [contacts-settings.ts](../src/shared/contacts-settings.ts) | 设置 DTO、默认值与路径校验，不包含档案实体 |
| [contacts.ts](../src/shared/i18n/contacts.ts) | 中英文界面文案 |
| [verify-contacts.ts](../scripts/verify-contacts.ts) | 协议、索引、控制器及模拟 Vault 回归检查 |

## 数据流与维护要点

```mermaid
flowchart LR
  Panel[卡片与详情页] --> Form[显式保存的编辑表单]
  Form --> Controller[ContactsController]
  Controller --> Queue[写入队列与冲突检查]
  Queue --> Files[库内 Markdown 文件]
  Files --> Events[Vault 文件事件与解析]
  Events --> Index[可重建的内存索引]
  Index --> Panel
```

面板是主要交互入口，Markdown 是资料来源。所有保存经过控制器；新档案使用 `Vault.create`，既有档案使用 `Vault.process` 对最新内容进行三方合并，删除使用 `FileManager.trashFile`。同一身份的更新串行处理，新建操作单独串行，防止同名文件创建互相覆盖。

保存时比较“打开表单时的内容、当前文件内容、草稿内容”。基础字段逐字段合并，正文逐区域合并；工作经历和人际关系分别作为整张表处理。保留未知属性、区域外文字和未编辑区域。遇到损坏文档、重复 ID、引用身份冲突或原始编辑器未保存修改时拒绝覆盖。不要用整份重新序列化替代这个过程。

`nand-id` 承担身份，文件名与显示名不承担身份。同名记录互相独立；修改显示名会更新仍使用默认标题的一级标题，不覆盖用户自定义标题，也不自动重命名文件。手工改名或移动文件后，面板通过身份重新定位，普通 Markdown 链接仍需保持可解析。

任职只存于人物文件，企业人员是派生视图；关系只存于录入方文件，反向关系是派生视图。不得为了两侧显示而增加双写。删除对象保留其他文件中的历史和失效引用。筛选不解析全库之外的资料，不将同企业成员自动推断为直接关系。

格式说明只在缺失时生成。修改它后重建插件，现有用户说明不会被覆盖。说明本身不得被识别为档案：若添加 YAML 范例，避免在说明文件中出现行首的 `nand-type:`（解析器用该属性初筛档案）。范例可以使用引用块或缩进，文档始终不能充当一份人物记录。

## 自动检查

从项目根目录执行：

```sh
pnpm run test:contacts
pnpm run test:settings-nav
pnpm run test:mobile-stability
pnpm run build
pnpm run lint
```

`test:contacts` 覆盖协议往返、未知内容保留、损坏文档、同名／稳定身份、任职统计、反向关系去重、5,000 条记录筛选、写入失败、目录切换、多窗口冲突及未保存编辑保护。设置与模块接线另由 `test:settings-nav` 检查。

`test:mobile-stability` 是已有的共享／看板回归脚本，不等于档案移动端验收。测试使用模拟 Obsidian API，构建和 lint 也不能替代真实应用中的视图验证。

## Obsidian 验收清单

以下项目供桌面、弹出窗口和手机实测使用，不表示已经全部通过：

- [ ] 从功能区和命令打开档案；关闭／重启模块后，入口、已有 leaf 和资料保留符合预期。
- [ ] 5／6 列设置随宽度变化；超过 60 条记录可翻页，进入详情再返回保留查询与滚动位置。
- [ ] 新增同名人物，编辑多项联系方式、Markdown 备注和日期，重启后资料一致。
- [ ] 同一人有多段职务时，企业人数去重；现任、曾任、关键人物列表正确。
- [ ] 从双方查看领导／下属与自定义关系；只写一份关系，删除目标后保留来源文字。
- [ ] 两个 leaf 同时编辑不同字段可以保存；同字段或同表修改产生冲突，复制草稿与重载可用。
- [ ] 原始笔记尚未保存时，面板拒绝覆盖；文件外部修改、重命名、删除后视图刷新。
- [ ] 切换资料目录后旧表单不能误写；切回原目录、从备份恢复原文件后可以重建。
- [ ] 将 leaf 移入弹出窗口再移回，表单、剪贴板、Markdown 渲染和事件清理正常。
- [ ] 手机上标签页菜单和详情按钮可操作；软键盘、窄屏长文本、滚动及安全区域显示正常。
- [ ] 停用／卸载插件后，直接打开 Markdown 仍可读取联系方式、履历与关系，外部附件链接可用。

## 当前验证记录（2026-09-27）

实现阶段已通过 19 项档案自动测试、设置导航测试、移动稳定性回归、生产构建与 lint（0 errors，存在仓库已有 warnings）。另做过临时 DOM 冒烟检查，覆盖卡片到详情、企业链接、分页、搜索及卸载；临时检查未注册为仓库测试命令，不能作为长期回归入口。

档案面板尚未完成真实 Obsidian 桌面、弹出窗口及手机设备验收。后续实测应记录应用版本、平台、执行项目与结果，再勾选上面的清单。
