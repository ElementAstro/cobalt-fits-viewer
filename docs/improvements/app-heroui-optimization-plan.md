# src/app HeroUI Native 组件优化计划

## 执行摘要

逐页检查 `src/app` 目录下所有页面，将原生 RN 组件（TouchableOpacity、自定义 checkbox、手动 toggle 等）替换为 HeroUI Native 组件，提升一致性、可访问性和可维护性。

## 可用但未充分使用的 HeroUI Native 组件

| 组件              | 当前使用  | 可优化场景                             |
| ----------------- | --------- | -------------------------------------- |
| Accordion         | ❌ 未使用 | 设置折叠面板、编辑器高级选项、堆叠页面 |
| Checkbox          | ❌ 未使用 | 堆叠页面 quality toggle、编辑器选项    |
| PressableFeedback | ❌ 未使用 | 替代 TouchableOpacity 列表项           |
| RadioGroup        | ❌ 未使用 | 算法选择、对齐模式选择                 |
| Select            | ❌ 未使用 | 设置页面 OptionPickerModal 替代        |
| Skeleton          | ❌ 未使用 | 文件加载、缩略图加载占位               |
| Surface           | ❌ 未使用 | 页面容器、信息卡片背景                 |
| Switch            | ✅ 已使用 | compose 页面 linked stretch toggle     |
| Tabs              | ❌ 未使用 | convert 页面模式切换、gallery 视图切换 |
| Toast             | ❌ 未使用 | 替代部分 Alert.alert 提示              |

## 逐页优化清单

### 1. (tabs)/index.tsx - 文件页

- [x] BottomSheet 导入选项：TouchableOpacity → PressableFeedback + Card 结构化
- [x] 搜索框清除按钮：TouchableOpacity → Button (ghost)
- [x] 排序 Chip：TouchableOpacity 包裹 → Chip 直接 onPress

### 2. (tabs)/gallery.tsx - 画廊页

- [x] 搜索框清除按钮：TouchableOpacity → Button (ghost)
- [x] 对象筛选 Chip：TouchableOpacity 包裹 → Chip onPress

### 3. (tabs)/targets.tsx - 目标页

- [x] 搜索框清除按钮：TouchableOpacity → Button (ghost)
- [x] 筛选 Chip：TouchableOpacity 包裹 → Chip onPress
- [x] 排序选项：Text 手动样式 → Chip 组件

### 4. (tabs)/settings.tsx - 设置页

- 已使用 Card + SettingsRow + Switch，结构良好
- 色彩选择器用 TouchableOpacity 是合理的（颜色圆点交互）

### 5. (tabs)/sessions.tsx - 会话页

- 已结构良好，Card 统计卡使用正确

### 6. editor/[id].tsx - 编辑器页

- [x] 工具选项栏：TouchableOpacity → PressableFeedback
- [x] 高级工具栏：TouchableOpacity → PressableFeedback

### 7. stacking/index.tsx - 堆叠页

- [x] Quality 评估 toggle：手工 View checkbox → Checkbox 组件
- [x] 折叠面板（Advanced Options, Calibration）：TouchableOpacity → Accordion
- [x] 文件选择 checkbox：手工 View → Checkbox 组件

### 8. compose/index.tsx - 合成页

- [x] Linked Stretch toggle：自定义 View → Switch 组件
- [x] Show/Hide Weights：TouchableOpacity → Switch

### 9. convert/index.tsx - 转换页

- [x] 模式切换 (单个/批量)：Chip → Tabs 组件
- [x] 文件选择卡片：TouchableOpacity + Card → PressableFeedback

### 10. header/[id].tsx - 头信息页

- [x] 分组筛选 Chip：TouchableOpacity 包裹 → Chip onPress

## 工作量估计

- 小型任务 (Chip/Button 替换): ~10 处, ~1hr
- 中型任务 (Checkbox/Switch/Accordion): ~5 处, ~2hr
- **总计**: ~3hr
