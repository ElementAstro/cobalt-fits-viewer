## Why

现有观测计划已支持创建、编辑、状态管理和日历同步，但在高频使用场景下仍存在录入效率低、时间冲突不透明、重复计划操作繁琐的问题。随着会话与目标数据持续增长，需要补齐计划管理闭环，降低夜间操作成本并减少漏拍风险。

## What Changes

- 增强计划录入流程：支持更直接的日期/时间调整与常用时长快捷项，减少反复微调时间的操作成本。
- 引入计划冲突与负载提示：在创建/编辑和列表展示阶段识别同时间段重叠计划，提前提示冲突风险。
- 增强计划复用能力：支持基于已有计划快速复制到新日期（rollover），并保留核心参数（目标、设备、地点、备注）。
- 优化计划执行衔接：从计划转会话后，保持计划状态与关联信息一致，便于回看“已执行/未执行”计划。

## Capabilities

### New Capabilities

- `observation-plan-workflow-enhancement`: 定义观测计划在录入、冲突检测、复用与执行衔接上的行为要求，提升计划管理效率和可靠性。

### Modified Capabilities

- None.

## Impact

- Affected code: `src/components/sessions/PlanObservationSheet.tsx`, `src/components/sessions/PlanActionSheet.tsx`, `src/components/sessions/PlanCard.tsx`, `src/app/(tabs)/sessions.tsx`, `src/lib/sessions/planUtils.ts`, `src/hooks/sessions/useCalendar.ts`, related tests.
- Affected behavior: 计划创建/编辑交互、计划卡片状态提示、计划列表操作项、计划到会话的转化链路。
- Dependencies/systems: Zustand session store (`plans`), calendar integration flow, i18n keys for sessions/plan actions, Jest component + utility tests.
