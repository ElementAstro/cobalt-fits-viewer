## Why

现有观测计划已经具备单条创建、编辑、复制、冲突提示和转会话能力，但当计划数量跨越多晚后，用户仍需逐条打开计划来识别“已过期但未处理”的安排、逐条顺延，或者逐条清理日历同步残留。随着 `Sessions` 页里计划条目持续增长，缺少批量维护能力会让计划列表越来越嘈杂，也更容易遗漏真正还要执行的目标。

## What Changes

- 为仍处于 `planned` 且结束时间早于当前时间的计划引入“过期计划”识别，并在计划列表/日期摘要中突出显示。
- 为观测计划增加批量维护工作流，支持多选后统一顺延、统一状态更新、批量删除，以及批量同步/取消同步到系统日历。
- 增加更聚焦的计划筛选入口，便于快速查看过期、未同步或存在冲突风险的计划，而不是依赖全文搜索逐项排查。
- 复用现有单条计划工具函数与日历链路，保证批量操作与现有复制、顺延、转会话规则保持一致。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `observation-plan-workflow-enhancement`: 扩展观测计划工作流要求，补充过期计划可见性、计划多选批量维护，以及面向高频整理场景的快速筛选能力。

## Impact

- Affected code: `src/app/(tabs)/sessions.tsx`, `src/lib/sessions/planUtils.ts`, `src/components/sessions/PlanCard.tsx`, `src/components/sessions/SessionDateSummary.tsx`, `src/components/sessions/ObservationCalendar.tsx`, `src/hooks/sessions/useCalendar.ts`, related i18n files and tests.
- Affected behavior: 计划列表筛选、计划卡片状态展示、日期摘要、计划批量操作入口、与系统日历的计划同步维护流程。
- Dependencies/systems: Zustand `plans` store access through `useCalendar`, calendar sync helpers, plan/session utility functions, Jest component and utility tests.
