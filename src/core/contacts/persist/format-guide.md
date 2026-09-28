# 档案格式 / Archive format

已保存的 Markdown 文件是档案资料的完整来源。日常使用档案面板查看和编辑；面板、搜索和人数统计可从文件重建，不需要 NAND 的 data.json。复制整个资料文件夹即可带走资料；正文引用的目录外附件需要另行复制。原始文件也可直接提供给 AI 阅读。未保存的表单草稿不在文件中。

Each person/company is one Markdown file. `nand-type` is `person` or `company`; `nand-id` is an immutable UUID. Names are not identifiers. Same-name people must remain separate.

面板只识别所选目录及其子目录中带有上述类型属性的档案，普通 Markdown 笔记不自动变成联系人。恢复原档案时保留其 ID；为另一个人物建档时生成新 ID，不能直接复制身份标识。

## 属性 / Properties

属性放在文件开头的 YAML frontmatter（两行 `---` 之间）。缺少可选字段时按空值处理，未知属性会保留。

| 属性 | 类型 | 含义 |
| --- | --- | --- |
| `nand-type` | 字符串 | `person` 或 `company` |
| `nand-id` | 字符串 | 稳定、唯一的档案身份；面板生成 UUID |
| `name` | 字符串 | 姓名或企业名，必填 |
| `birthday` | 字符串 | 出生日期 `YYYY-MM-DD`，可留空 |
| `birthplace` | 字符串 | 出生地 |
| `region` | 字符串 | 人物当前地区或企业地区，二者独立填写 |
| `website` | 字符串 | 企业网址 |
| `aliases` | 字符串列表 | 别名 |
| `mobiles`、`phones` | 字符串列表 | 手机号、固定电话 |
| `wechat`、`emails` | 字符串列表 | 微信、邮箱 |
| `tags` | 字符串列表 | 标签 |

人物不生成企业网址字段，企业不生成生日和个人联系方式字段。未知属性仍会保留。更改显示名称不会自动重命名文件。

电话始终按字符串填写，例如 `phones: ["057100000000"]`，保留前导零和 `+` 号。列表推荐使用 YAML 数组；单个文本值也可读取为一项。生日推荐加引号，例如 `birthday: "1990-05-20"`。

## 工作经历 / Employment

The table between `<!-- nand:employments -->` and `<!-- /nand:employments -->` uses these semantic columns (new tables display localized English or Chinese headings):

| company                 | department | title | start   | end | status  | key_role | notes    |
| ----------------------- | ---------- | ----- | ------- | --- | ------- | -------- | -------- |
| [公司](../企业/公司.md) | 部门       | 职务  | 2020-01 |     | current | leader   | 任职备注 |

`status`: current（现任）or past（曾任）, independent of missing dates. Dates accept YYYY-MM or YYYY-MM-DD. Concurrent jobs are allowed. `key_role`: empty, leader（负责人）, contact（关键联系人）. A company's employee count means recorded current contacts, deduplicated by person UUID, not its total workforce.

现任经历的 `end` 必须为空；曾任经历可保留未知起止时间。关键人物来自现任经历的 `key_role`。企业人员列表由人物履历计算，不在企业文件内维护第二份人员名单。表头顺序须保持不变；支持下列机器字段名及 NAND 生成的中英文表头，切换界面语言仍可读取。

## 人际关系 / Relationships

| person          | kind   | company                 | notes    |
| --------------- | ------ | ----------------------- | -------- |
| [李四](李四.md) | leader | [公司](../企业/公司.md) | 直属领导 |

Stored between `<!-- nand:relations -->` and `<!-- /nand:relations -->`.
The linked person is the note owner's `kind`: leader（领导）, report（下属）, colleague（同事）, friend（朋友）, or a custom label. The inverse is computed, not written to a second file. Shared employers do not prove a direct relationship.

例如这张表位于张三的档案时，上例表示“李四是张三的领导”；李四面板中显示“张三是下属”。`company` 可以为空。自定义关系只保留原始称谓与来源，不猜测其反向含义。

`<!-- nand:row UUID -->` identifies a row. `<!-- nand:ref UUID -->` identifies a link target even after a rename. Keep these when possible. Human-readable links and table content carry the facts; comments only carry identity. New manually written rows can omit identifiers if their links resolve. Unknown/broken targets remain in the file.

使用标准 Markdown 相对链接（相对于当前文件），不是 `[[双链]]`；路径中的空格等特殊字符应进行 URL 编码。表格行标识放在第一列，目标标识紧跟对应链接。不要将一个对象的链接与另一个对象的 ID 拼在一起；可见链接和身份指向不同对象时会阻止面板保存。

## 自由文字 / Prose

`traits` 性格与偏好，`habits` 生活习惯，`notes` 备注／企业特别情况 are ordinary Markdown between matching nand markers. Text outside these regions and unknown properties are preserved. Do not duplicate or nest region markers. Within tables use `&#124;` for a literal pipe, `&#92;` for a backslash, and `<br>` for line breaks.

## 使用与恢复 / Usage and recovery

面板通过明确的保存操作写入资料。不同基本字段或不同正文区域的外部修改可合并；同一字段或同一张履历／关系表的并发修改会报告冲突，保留当前表单草稿。表格冲突按整张表处理，不按行合并。可复制草稿后重新载入原始资料；复制内容为 JSON，仅用于留存输入，不是 Markdown 导出。

Changing the configured folder switches the data source; it does not move or delete the old folder. Deletion follows Obsidian's file deletion settings and keeps references in other records. Disabling or uninstalling NAND does not remove saved archive files. Keep an independent backup for disk failure or accidental deletion.

本说明在创建档案且目录中缺少说明文件时生成。升级不会覆盖已有说明文件，也不会自动改写全部档案。
