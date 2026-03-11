## Why

当前应用已经在部分页面支持横屏，但适配策略分散在不同组件中，存在布局不一致、信息遮挡和交互密度不稳定的问题。现在集中做一次逐组件横屏补齐，可以减少回归、统一体验，并为后续新功能复用同一套横屏规范。

## What Changes

- 盘点所有核心页面与可复用组件的横屏表现，建立统一的横屏适配检查清单。
- 为未完成或不一致的组件补齐横屏布局规则，包括间距、信息层级、可点击区域与滚动行为。
- 统一横屏下的双栏/侧栏与紧凑模式判定，减少每个页面自行实现的分叉逻辑。
- 为横屏关键路径增加可重复验证的测试覆盖（单测与路由流检查），确保后续修改不回退。

## Capabilities

### New Capabilities

- `landscape-component-adaptation`: 定义核心页面和复用组件在横屏下的布局、交互与可测性要求，确保逐组件检查和修复有统一验收标准。

### Modified Capabilities

- None.

## Impact

- Affected code: `src/app/**`, `src/components/**`, `src/hooks/common/useResponsiveLayout.ts`, related tests in `__tests__/`.
- Affected behavior: 横屏下页面信息组织、组件排版密度、工具栏/筛选栏展示策略、滚动与触控可用性。
- Dependencies/systems: React Native layout system, Expo Router screens, orientation hooks, Jest + route parity checks.
