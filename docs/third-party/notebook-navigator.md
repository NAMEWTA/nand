# Notebook Navigator 参考范围

[笔记导航器](../navigator.md)的交互参照 [Notebook Navigator](https://github.com/johansan/notebook-navigator)（johansan/notebook-navigator，GPL-3.0）。NAND 只参考它的**行为**：双栏结构、键盘表、多选方式、拖放、预览和缩略图的概念，以及搜索过滤语法、日历与周期笔记、模板标记、自定义创建命令、库配置档、合并笔记和标签操作的使用方式。**NAND 没有包含它的任何源代码、注释或样式文本**；`src/modules/navigator/` 是按 NAND 的模块结构、React 与设计系统令牌独立重写的，缓存、选择和键盘处理都是另行设计的实现。

为保证这一点：

- 每个导航器源文件头部写明 `Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.`；
- 审查时对上游源码运行 `pnpm run check:similarity`，超过阈值的片段逐条解释或改写；
- NAND 仍以 MIT 许可证分发，不引入 GPL 依赖。

参考的版本是 v3.4.x 的公开文档和行为，不表示 NAND 跟随它的后续版本。
