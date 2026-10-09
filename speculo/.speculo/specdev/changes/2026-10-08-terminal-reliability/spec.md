---
schema_version: 3
artifact: "spec"
change: "2026-10-08-terminal-reliability"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

# Spec: 终端 helper 可安装性、错误反馈与句柄隔离

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

确保新安装真实下载校验后可打开Shell/Agent，并区分未发布资产与网络错误；Unix helper启动时不继承渲染进程无关句柄。

### 当前事实

当前0.0.1-alpha.1 Release已有五平台helper和校验和；旧1.0.0背景不再成立。BinaryError含message但controller映射为笼统http文案；main.rs尚无继承FD清理。

### 目标用户与场景

- 作为桌面用户，我在全新安装中能打开Shell和已安装的Agent，失败时知道版本资产或网络哪一步出了问题。
- 作为多进程宿主用户，helper只持有工作所需资源且正常退出。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- 发布新版本/推送tag/下载旧helper兜底、GPL终端代码、把所有进程fd≥3都关闭

## 2. 解决方案与外部行为

新安装选择Agent/Shell后检测平台→取得对应版本digest→下载→校验→原子替换→握手→启动。404与非200包含状态和发行版本，网络失败/timeout单独可见，校验失败保留原文件，不把失败标为可用。日志记录原始GitHub资产地址而非带token的重定向URL。已有匹配stamp且digest正确可复用，离线模式沿用显式限制。

Unix进程main最早清除继承非stdio句柄，之后建立自己的IPC/线程/PTY/索引。运行中helper自身资源不得误删；shutdown/stdin关闭和shell子进程行为保持。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为桌面用户，我在全新安装中能打开Shell和已安装的Agent，失败时知道版本资产或网络哪一步出了问题。
- **US-002**：作为多进程宿主用户，helper只持有工作所需资源且正常退出。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 全新库无binaries且无需覆盖变量 | 打开Shell及可用Agent | 从当前Release下载匹配资产、digest校验、协议握手和会话打开 | ensureHelper+真实fresh宿主 |
| AC-002 | 404、503、超时或断网 | 发起安装 | 404说明该版本资产未发布，HTTP带状态，网络另文案；日志原始URL可诊断且无凭据 | BinaryError/controller/i18n |
| AC-003 | 旧二进制存在、新digest不符 | 尝试升级与重试 | 旧文件不被覆盖，错误可恢复，五平台命名和sha256清单准确 | binary.test/release资产检查 |
| AC-004 | Linux父进程传入非CLOEXEC文件/socket哨兵 | 启动helper→创建PTY | stdio可用；父哨兵消失；只剩helper自己创建资源，真实宿主无Chromium共用IPC | native stdio集成+proc fd观察 |
| AC-005 | Linux/macOS及Windows构建 | Shell输入输出resize→关闭stdin/重启 | PTY工作、退出无孤儿；macOS路径被验证、Windows不误用fd处理 | native tests/五平台CI/verify-pty-helper |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- #135下载/文案/发布矩阵全部核销
- #143Linux修复和macOS实现检查、Windows保持不变

### REUSE

- 现有ensureHelper校验/原子替换、stdio协议3、五平台CI与exit清理

### OUT

- **OOS-001**：发布新版本/推送tag/下载旧helper兜底、GPL终端代码、把所有进程fd≥3都关闭

## 6. 已锁定实现约束

- **DEC-001**：保持当前同版本资产+校验和合同，不静默回退旧GPL/旧协议helper，404指明未发布。 来源：LOG-001；#135及dev licensing。
- **DEC-002**：第一步清理继承的fd≥3，再创建job/channel/thread/PTY/history；保留0/1/2且Windows不执行POSIX代码。 来源：LOG-002；#143。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

BinaryError扩展结构化HTTP状态与规范化原始资产URL，controller与双语文案消费；不更改协议3或stamp格式。Unix代码限定平台cfg，Linux close_range与明确兼容路径；macOS用可验证的closefrom/范围接口择一，具体平台方法是可逆实现细节。不得遍历关闭已开PTY。

## 8. 非功能要求

- **NFR-001**：诊断不泄露代理认证或重定向签名参数；二进制必须通过已有digest验证。
- **NFR-002**：不在每次会话重复下载已验证二进制；启动FD清理有界，不引入无限扫描重试。
- **NFR-003**：清理只在最早单线程阶段；下载失败保留已安装文件；模块卸载关闭会话。
- **NFR-004**：状态码/版本/平台和步骤可观察；每个平台实测或CI状态单列。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-002, AC-003 | pnpm exec vitest run src/modules/agent/platform/desktop/pty/binary.test.ts test/release/release-artifacts.test.ts; download seam给404/503与网络异常，再做fresh宿主提示观察; 读取执行期manifest版本（规划基线0.0.1-alpha.1），从对应真实GitHub Release下载五平台nand-pty和sha256到独立临时资产目录；node scripts/verify-release-artifacts.mjs <manifest.version> <downloaded-terminal-dir>；fresh宿主真实Shell启动与重启 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-004, AC-005 | pnpm run check:native; node scripts/verify-pty-helper.mjs native/pty-server/target/release/nand-pty; 父传入非CLOEXEC哨兵与大量fd，Linux检查/proc/helper/fd; 真实Obsidian启动/重启两次、macOS/Windows CI | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- 真实下载验收不能设置NAND_PTY_BINARY，否则掩盖#135。
- 仅设CLOEXEC不能移除helper自己持有的资源，不能当作#143完整修复。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
