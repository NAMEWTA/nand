# 动效与无障碍

## 动效

- 只对 `transform` 和 `opacity` 做动画。不要对宽度、高度、网格轨道或内边距做动画。
- 时长来自 `--nand-duration-fast`（120ms：悬停、小的淡入淡出）、`--nand-duration`（180ms：面板、页面淡入）和 `--nand-duration-slow`（240ms）；缓动用 `--nand-ease`。
- 侧栏的打开／关闭使用 FLIP（`src/shell/Shell.tsx`、`src/shell/styles/shell.css`）：网格一次性跳到最终布局（页面只布局一次，观察者只触发一次），然后侧栏和页面从偏移的 `translateX` 动画回到零。根元素带着 `is-opening` / `is-closing` 共 200ms。
- 终端和其他需要测量的内容在动效结束后适配一次，而不是每一帧都适配。
- 页面切换短暂淡入；切换终端或浏览器标签不做动画。
- `prefers-reduced-motion: reduce` 会关闭动画：shell 跳过动效类名，CSS 移除 `.nand-shell` 下的动画。新的动画遵守同样的规则。
- 不要在输入或终端输出的热路径上做动画。

## 键盘

| 位置 | 按键 |
|---|---|
| Shell | F6 / Shift+F6 在图标轨、侧栏和页面之间循环焦点 |
| 图标轨 | 方向键、Home 和 End 在图标间移动（漫游焦点）；Enter 或 Space 激活 |
| 侧栏 | 上、下键在行之间移动；Enter 打开 |
| 侧栏分隔条 | 方向键调整宽度，Home 和 End 跳到最小和最大宽度 |
| 覆盖式侧栏 | Esc 关闭并把焦点还给来源处；打开期间焦点保持在内部 |
| 标签条 | 方向键、Home 和 End 移动，Delete 关闭，中键关闭 |
| 对话框 | Obsidian 的 `Modal` 处理 Esc 和焦点；主操作放在最后 |

NAND 不设默认快捷键；用户自己绑定命令。

## 语义

- 地标：图标轨是 `nav`，侧栏是 `aside`，页面是 `main`。图标轨用 `aria-current` 标记当前模块，用 `aria-expanded` 标记侧栏开关。
- 路由变化在礼貌（polite）的实时区域中播报；忙碌提示用 `role="status"`，错误用 `role="alert"`。
- 每个只有图标的按钮都有可访问名称（`IconButton` 的 `label`，或 `aria-label` + `setTooltip`）。输入框有标签；帮助文字用 `aria-describedby` 关联，不要塞进标签里。
- 使用原生的 `button`、`input`、`select`。可点击的 `div` 是缺陷；如果某个元素不能是按钮，就给它 role、`tabindex` 和 Enter/Space 处理。
- 保留 `:focus-visible` 轮廓（`--nand-focus-ring`）；绝不移除焦点样式。
- 隐藏的页面是 `hidden` 且 `inert`，焦点和读屏会跳过它们。

## 尺寸与对比度

- 点击目标至少 32px；触屏目标 44px（`--nand-touch-target`）。
- NAND 界面里的正文在每种样式和明暗模式下与背景的对比度达到 7:1，次要文字以及链接或强调色文字达到 4.5:1（`src/theme/presets.test.ts`）。淡色文字（`--text-faint`）是 3:1：只用于装饰和非必要的提示，不用于用户必须阅读的内容。
- 不要只靠颜色传达状态：状态色要配图标或文字。
