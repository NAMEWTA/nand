# ADR-0001：五层依赖边界

状态：已接受，当前规范。核对日期：2026-10-01。

## 问题

多个界面需要复用同一领域能力，领域规则不能绑定插件实例或原生叶子。

## 决策

保留 plugin / view / platform / core / shared。plugin 负责装配与跨域协调；view 依赖显式状态和动作端口；platform 适配宿主；core 持有领域规则；shared 仅保留基础接口、序列化、通用协议和 I18N。core 不导入 Obsidian，platform 不导入 plugin/view，view 不导入 plugin，包括类型导入。

## 取舍与约束

接受端口与装配代码的成本，换取领域复用和独立测试。内部模块不拆成独立 npm 包，不建立多应用 monorepo。视图类型与文档身份标识保持稳定。

## 验证依据

[当前源码](../../../../scripts/verify-architecture.mjs)。pnpm test:architecture；静态检查不能证明计算得到的动态模块名称。

本页描述当前工作区的有效决定，不反写历史实施时间。实际执行结果见[当前基线](../archive/2026-10/2026-10-01-current-baseline/README.md)。
