---
schema_version: 3
artifact: "spec"
change: "2026-10-08-private-storage-permissions"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

# Spec: NAND 私有目录和文件的最小POSIX权限

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

收紧桌面POSIX .nand配置/运行数据的目录与文件权限，兼容旧库、克隆库与原有读写。

### 当前事实

JsonStore/DurableState/adapter写入按umask，native SQLite同样会创建文件；浏览器用户数据目录已显式0700/0600，库内目前不一致。

### 目标用户与场景

- 作为多用户系统用户，我的隐藏会话和浏览状态不会因默认umask对其他账户开放。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- 普通笔记权限、加密、ACL迁移、远程Git历史清除、WindowsPOSIX模拟

## 2. 解决方案与外部行为

插件启动读取vault adapter类型；POSIX文件系统适配先确保.nand根是合法目录并收紧根目录，随后只对插件管理的既有路径进行一次有界修复。新建目录和文件从创建起使用限制mode，后续rename/原子写保留。用户正常使用各模块不新增交互；权限失败记录路径类别/原因但不输出正文，不阻断其它模块读取。

遇到软链接或根外目标跳过并报告，不递归跟随；普通笔记保持原mode。移动、Windows及非本地adapter沿用原读写。Git不保存这些mode，克隆设备第一次加载重施。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为多用户系统用户，我的隐藏会话和浏览状态不会因默认umask对其他账户开放。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | umask022空库POSIX | 启用各模块写配置/浏览/历史/通知/评论 | 所有创建.nand目录0700文件0600，普通笔记mode不变 | 真实fs stat |
| AC-002 | 旧库或Git clone目录755文件644 | 加载一次再重载 | .nand根/管理子路径收紧，字节相同且无重复大量扫描 | 旧库fixture真实fs |
| AC-003 | .nand根或中间路径symlink指向vault内普通笔记或根外，另有权限拒绝 | 运行修复/写入 | 不跟随symlink创建或chmod其目标，普通笔记/外部哨兵不变；权限修复失败非致命，不删除数据 | lstat边界与拒绝权限fixture |
| AC-004 | Windows/mobile/nonfilesystem | 读写与模块开关 | 无POSIX调用且读写同步保持 | platform guard+宿主 |
| AC-005 | native创建或重建SQLite与旁文件 | 历史搜索更新/恢复草稿/原子保存 | 目录0700数据库和旁文件0600，历史与恢复正常 | native history+fs |
| AC-006 | 用户阅读数据/隐私说明 | 查看平台及Git同步章节 | 说明0700/0600与clone重施，明确非加密不变更笔记 | docs核对 |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- 新写入、旧库一次收紧、Git clone后加载修复
- JS存储与native SQLite创建/旁文件覆盖、文档双语

### REUSE

- 现有TextStorage/JsonStore/DurableState冲突与恢复、native历史索引

### OUT

- **OOS-001**：普通笔记权限、加密、ACL迁移、远程Git历史清除、WindowsPOSIX模拟

## 6. 已锁定实现约束

- **DEC-001**：仅桌面FileSystemAdapter且POSIX；目录0700文件0600；Windows/mobile/nonfilesystem保持原行为。 来源：LOG-001；#144。
- **DEC-002**：加载时收紧.nand根及管理子路径；不跟随symlink、不修改根外对象，失败日志非致命。 来源：LOG-002；#144+存储架构。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

新增desktop权限适配在src/host/desktop下，Obsidian adapter装配在host/obsidian或app；shared只依赖纯接口，不导入fs/obsidian。覆盖配置、浏览、Agent标签/SQLite与-wal/-shm、automation、notification、comments/icons、recovery/cache，按真实owner枚举写入口，不能只chmod一次已有文件遗漏新文件。native直接创建索引也遵守限制，不全局修改Obsidian进程umask。 所有新增news/browser历史writer消费该host私有storage端口；后续票不复制独立chmod实现。根和每级中间目录以lstat识别symlink，目标即使仍在vault内也不能跟随至普通笔记。

## 8. 非功能要求

- **NFR-001**：symlink与路径边界强制；只改.nand，内容字节不动，不声称避免用户主动push导致泄露。
- **NFR-002**：首次修复有界，后续按写入口；不每次渲染全库递归。
- **NFR-003**：chmod失败非致命，不以失败触发删库/自动放宽；DurableState三方保护保持。
- **NFR-004**：权限失败可观察但降噪，每设备报告失败类别；文档解释适用平台和Git恢复行为。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-002, AC-003, AC-004, AC-006 | 真实临时vault在umask022创建各类JSON与目录，stat并比较内容digest; 权限拒绝、symlink目标哨兵、只读adapter场景; pnpm exec vitest run src/shared/storage src/host src/shared/settings; pnpm test:architecture | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-005 | pnpm run check:native; pnpm exec vitest run src/modules/agent/platform/desktop/server/native-history.test.ts; 分别令.nand根与中间目录symlink指向库内普通笔记或库外哨兵，发送真实索引请求; 重建SQLite、启动/关闭helper并核验可能存在的-wal/-shm | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/evidence/T-02.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- 一次根chmod可隐藏旧文件但不满足新文件0600合同，需检查全写链。
- SQLite旁文件由native创建，必须跨语言处理；禁止移动代码导入Node。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
