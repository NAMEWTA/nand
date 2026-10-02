# ADR-0002：原生宿主生命周期与 Preact 界面

状态：已接受，当前规范。核对日期：2026-10-01。

## 问题

叶子、分屏、弹窗和弹出窗口需要同一业务面板，资源必须随正确宿主释放。

## 决策

Obsidian 管理叶子、Modal、设置和原生菜单，Preact 功能面板接收状态与动作。面板内渲染使用 contentEl；跨叶子拖动使用所属 Window 的共享根与 portal。窗口迁移重新绑定宿主；关闭时卸载根、计时器和订阅。服务状态独立于渲染，设置继续使用原生 Setting。

## 取舍与约束

保留单入口打包、单份 styles.css 和 nand-ui-* 令牌。关闭界面不应重置业务状态；需要终止进程时显式调用服务。

## 验证依据

[当前源码](../../../../src/view/dashboard/renderer/render-context.ts)。pnpm test:panel-composition、pnpm test:card-panels；实机检查分屏、窄屏与窗口迁移。

本页描述当前工作区的有效决定，不反写历史实施时间。实际执行结果见[当前基线](../archive/2026-10/2026-10-01-current-baseline/README.md)。
