## Context

`Sessions` 页的观测计划工作流已经覆盖单条计划的主要动作：

- `src/components/sessions/PlanObservationSheet.tsx` 负责创建/编辑、时间快捷调整、冲突确认
- `src/components/sessions/PlanActionSheet.tsx` 负责单条计划动作
- `src/app/(tabs)/sessions.tsx` 负责计划列表、筛选、日期联动与转会话
- `src/hooks/sessions/useCalendar.ts` 负责计划持久化和系统日历同步
- `src/lib/sessions/planUtils.ts` 已有筛选、排序、冲突检测、复制/顺延等纯函数

上一轮增强主要解决“单条计划好不好编辑”，但没有解决“计划多了以后怎么整理”。当前列表只有按状态/关键词/排序查看，用户无法把过期未处理的计划快速收束，也无法像会话一样对多条计划做集中维护。这个变更是一次工作流层的补全，涉及列表状态建模、批量交互、日历批处理和回归测试，因此需要先固定技术方案。

## Goals / Non-Goals

**Goals:**

- 为已过结束时间但仍处于 `planned` 的计划提供明确且可测试的“过期计划”派生状态。
- 在计划列表中增加面向整理场景的快捷筛选，能快速定位过期、未同步和冲突计划。
- 为计划增加多选与批量维护能力，覆盖顺延、状态更新、删除、同步/取消同步到系统日历。
- 保持现有单条编辑、复制、顺延和转会话行为不变，只在其上补充批量维护闭环。

**Non-Goals:**

- 不引入“重复计划 / recurrence”或自动定时重排。
- 不新增持久化字段，也不把 `ObservationPlan.status` 扩展为新的枚举值。
- 不重做整页视觉结构；继续沿用 `Sessions` 页现有卡片、筛选 chip 和 summary dialog 组合。
- 不把计划批量操作抽象成跨 session/plan 的通用框架，本次只解决观测计划维护。

## Decisions

### 1. `overdue` 保持为派生状态，不写入 `ObservationPlan`

- Decision: 在 `src/lib/sessions/planUtils.ts` 增加纯函数（如 `isPlanOverdue`、`buildPlanQueueFlags`），以 `status === "planned"` 且 `endDate < now` 作为过期判断标准；卡片、日期摘要、筛选逻辑统一消费该结果。
- Rationale: `overdue` 是随当前时间变化的视图状态，不是稳定业务状态；写入 schema 会扩大影响到备份、恢复、i18n、历史数据和现有排序逻辑。
- Alternative considered: 新增 `status: "overdue"`；被拒绝，因为它混淆“计划还未完成”与“计划生命周期中的临时视图”。

### 2. 维护型筛选作为独立维度叠加在现有状态筛选之上

- Decision: 保留现有 `planned/completed/cancelled/all` 状态筛选，再增加一组“维护队列”筛选（`all/overdue/unsynced/conflict`），并扩展 `filterObservationPlans` 以同时接受状态、搜索词、日期和维护队列条件。
- Rationale: `overdue`、`unsynced`、`conflict` 都不是互斥状态，它们与原有状态过滤正交，拆成第二维筛选更符合用户心智，也避免挤压当前状态 filter 的意义。
- Alternative considered: 把 `overdue/unsynced/conflict` 塞进现有 `PlanStatusFilter`；被拒绝，因为会让类型和 UI 语义都变得混乱。

### 3. 批量顺延直接修改原计划时间，并使用固定天数偏移保持相对间距

- Decision: 计划多选后的“顺延”采用对现有计划原地更新的方式，提供固定偏移（优先 `+1 day`、`+7 days`）而不是复制新计划；实现上在 `planUtils` 增加基于本地日历天数平移的 schedule helper，并复用已有冲突检测函数预估结果。
- Rationale: 对“过期未处理计划”的常见操作是把它们整体往后挪，而不是复制出一批新计划保留旧计划。固定偏移还能保留多条计划之间原有的相对时间关系。
- Alternative considered: 批量动作只做“复制到次日”；被拒绝，因为会保留旧的过期计划，反而加重列表噪声。

### 4. 批量顺延沿用现有冲突策略：允许继续，但必须先看到风险

- Decision: 对批量顺延结果做一次统一冲突预计算；若更新后任一计划会与未选中或同批次计划重叠，则在执行前给出汇总告警，用户确认后才继续。
- Rationale: 当前单条计划保存已采用“冲突告警 + 用户确认”的工作流，批量顺延应保持同一原则，否则会出现单条编辑严格、批量操作绕过校验的问题。
- Alternative considered: 批量顺延不做额外告警，执行后再靠列表标识发现冲突；被拒绝，因为这会显著增加误操作成本。

### 5. 批量选择与摘要反馈放在 `sessions.tsx`，日历副作用批处理放在 `useCalendar`

- Decision: `selectedPlanIds`、计划选择模式、确认弹窗和 `OperationSummaryDialog` 汇总仍放在 `src/app/(tabs)/sessions.tsx`；而涉及系统日历写入/删除的计划批量同步与取消同步新增到 `useCalendar` 中，复用已有权限、haptic 和错误处理逻辑。
- Rationale: 选择状态是纯 UI concerns，适合留在页面层；日历侧副作用与权限分支已经集中在 `useCalendar`，继续下沉可以避免多处重复处理 `syncing`、permission 和部分失败统计。
- Alternative considered: 把全部批量维护逻辑都塞进 `useCalendar`；被拒绝，因为这会让 hook 同时承担太多 UI 编排职责。

### 6. 计划批量操作使用独立选择栏，而不是强行抽象 session 选择栏

- Decision: 参考 `SessionSelectionBar` 新增 plan-specific 选择栏组件，提供“全选、顺延、状态更新、sync/unsync、删除”等动作入口；不在本次重构为通用组件。
- Rationale: 计划批量动作与 session 批量动作集合不同，直接共用会引入条件分支和低可读性；单独组件更容易快速交付并单测。
- Alternative considered: 抽象通用 `SelectionBar` 配置化渲染；被拒绝，因为收益不足以覆盖当前重构成本。

## Risks / Trade-offs

- [Risk] 过期状态依赖当前时间，容易导致 UI 和测试结果不稳定  
  → Mitigation: 在工具函数层统一接收可选 `now` 参数，组件测试中固定时间基准。

- [Risk] 批量顺延可能导致新的计划冲突或把冲突批量带到未来  
  → Mitigation: 执行前预计算冲突数量并给出确认提示，执行后继续保留列表级冲突标识。

- [Risk] 计划批量同步/取消同步如果逐条提示，会造成大量噪音  
  → Mitigation: 统一返回 summary，页面层通过 `OperationSummaryDialog` 一次性展示成功、跳过、失败统计。

- [Trade-off] 不新增持久化字段意味着“过期”无法被备份快照直接记录  
  → Mitigation: 该状态本身可由时间与 status 重新计算，不会丢失业务信息。

- [Trade-off] 固定顺延偏移比自定义日期选择更受限  
  → Mitigation: 先覆盖最常见的 `+1 day / +7 days` 整理动作，后续若有明确需求再单独扩展到自定义目标日期。

## Migration Plan

1. 扩展 `planUtils`：增加过期/维护队列派生判断、支持维护型筛选、补充批量顺延 schedule helper 和冲突预估函数。
2. 在 `useCalendar` 中补充计划批量同步/取消同步 helper，并定义批量结果 summary 结构。
3. 更新 `sessions.tsx`：加入计划选择模式、维护型筛选 chips、批量操作 handler、结果汇总 dialog。
4. 新增或更新计划相关组件（计划选择栏、`PlanCard`、`SessionDateSummary`、必要时 `ObservationCalendar` 图例）以展示过期/维护状态。
5. 补充 `planUtils`、计划列表页面和批量交互测试，覆盖过期识别、筛选组合、批量顺延冲突确认和批量 calendar 操作汇总。
6. 运行 `pnpm typecheck && pnpm lint && pnpm test`；若批量交互引发明显回归，可先回退 UI 选择模式而保留底层 helper。

## Open Questions

- 批量状态更新是否需要同时支持 `planned/completed/cancelled` 三种目标状态，还是只暴露最常见的“标记完成 / 标记取消”？
- 维护型筛选是否需要在日历上增加额外图例，还是仅在列表与日期摘要中表现即可？
- `+7 days` 是否足够覆盖“延期到下个合适观测窗”的主要场景，还是后续要补自定义日期选择器？
