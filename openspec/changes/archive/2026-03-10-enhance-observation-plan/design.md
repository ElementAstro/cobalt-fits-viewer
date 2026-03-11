## Context

`Sessions` 页已经具备观测计划的增删改查、状态切换、与系统日历双向同步能力，核心入口在：

- `src/components/sessions/PlanObservationSheet.tsx`（创建/编辑）
- `src/components/sessions/PlanActionSheet.tsx`（计划操作）
- `src/app/(tabs)/sessions.tsx`（列表、筛选、转会话）
- `src/hooks/sessions/useCalendar.ts`（计划持久化与日历同步）
- `src/lib/sessions/planUtils.ts`（筛选/排序/转会话等工具）

当前短板主要是工作流层面：计划时间录入与调整偏慢、重叠冲突不可见、已有计划复用成本高，以及计划转会话时缺少重复转换保护。该变更跨 UI、业务工具函数与测试层，属于中等规模横切改动，需要先定义一致的技术方案。

## Goals / Non-Goals

**Goals:**

- 提供更高效的计划录入体验（日期/时间快捷调整、时长快捷项）。
- 在创建/编辑和列表展示阶段识别并提示计划时间冲突。
- 支持计划复制/顺延（rollover）以复用目标与设备配置。
- 让“计划转会话”流程具备重复转换保护，减少误触产生重复会话。

**Non-Goals:**

- 不引入新的远端服务或云同步通道。
- 不更改核心导航结构，不新增独立规划页面。
- 不修改现有日历服务协议（仅复用当前 `createPlanEvent/updatePlanEvent` 流程）。
- 不进行全量视觉重设计，重点是工作流可用性与一致性。

## Decisions

### 1. 冲突检测逻辑下沉到 `planUtils`，UI 层只做展示与确认

- Decision: 在 `src/lib/sessions/planUtils.ts` 增加纯函数（如重叠判断、冲突列表计算、复制时间偏移），`PlanObservationSheet` 和 `PlanCard` 仅消费结果并渲染提示。
- Rationale: 纯函数可单测、可复用，避免在 `sessions.tsx` 与多个组件中重复实现时间比较逻辑。
- Alternative considered: 在每个组件内分别实现冲突判断；被拒绝，因为易出现口径不一致和测试缺口。

### 2. 采用“非阻塞告警 + 用户确认”冲突策略

- Decision: 创建/编辑计划遇到冲突时先提示冲突详情，允许用户确认后继续保存，而不是硬阻止保存。
- Rationale: 天文观测常存在故意重叠（备选目标、机位切换），硬性禁止会破坏真实使用场景。
- Alternative considered: 冲突即拒绝提交；被拒绝，因为灵活性不足。

### 3. 复制/顺延走现有创建链路，避免新增并行写入流程

- Decision: `PlanActionSheet` 新增“复制计划/顺延到次日”动作，先生成新计划草稿，再调用 `createObservationPlan` 完成保存与日历同步。
- Rationale: 复用既有保存和权限处理逻辑，减少分叉路径与回归风险。
- Alternative considered: 直接在 store 中插入新 plan 并独立处理日历；被拒绝，因为会绕开统一同步策略。

### 4. 不新增持久化字段，通过规则识别“已由计划转换的会话”

- Decision: 不修改 `ObservationPlan` 数据结构；通过现有 `buildSessionFromPlan` 产出的 `session.id` 前缀（`from_plan_<planId>_...`）检测重复转换风险。
- Rationale: 保持备份/恢复与迁移兼容，避免引入跨模块 schema 变更。
- Alternative considered: 新增 `convertedSessionId` 等持久化字段；被拒绝，因为会扩大改动面到备份、导入导出和历史数据迁移。

### 5. 增量交付并覆盖关键自动化测试

- Decision: 先实现工具函数与计划表单交互，再补操作菜单和列表提示，最后完善单测与页面回归测试。
- Rationale: 先稳定核心逻辑，再收敛交互细节，便于快速定位问题。
- Alternative considered: 一次性修改全部组件后再补测；被拒绝，因为调试和回归定位成本高。

## Risks / Trade-offs

- [Risk] 冲突检测在跨时区或夏令时边界出现误判  
  → Mitigation: 统一使用 ISO 时间戳毫秒值比较，并补充跨日边界测试用例。

- [Risk] 非阻塞冲突提示被用户忽略，仍产生低质量计划  
  → Mitigation: 在冲突数量大于 0 时提高提示显著性（卡片标识 + 提交前确认）。

- [Risk] 复制计划可能复制过期时间导致无效计划  
  → Mitigation: 顺延动作默认按天平移开始/结束时间，并允许二次编辑确认。

- [Trade-off] 保持 schema 不变会限制“计划与会话强关联”的表达能力  
  → Mitigation: 先用规则识别满足当前需求，后续若需要统计级关联再单独提 schema 变更。

## Migration Plan

1. 扩展 `planUtils`（冲突计算、复制/顺延辅助函数）并补充对应单测。
2. 更新 `PlanObservationSheet`：加入快捷时间能力与冲突提示确认流程。
3. 更新 `PlanActionSheet` / `sessions.tsx`：加入复制/顺延入口与处理函数。
4. 更新 `PlanCard` / 计划列表：显示冲突或风险标识（仅展示，不写入持久层）。
5. 补充组件与页面测试（含重复转换保护、冲突提示行为）。
6. 运行 `pnpm typecheck && pnpm lint && pnpm test` 验证；如有回归按模块级提交回滚。

## Open Questions

- 复制计划默认目标日期应为“次日同一时段”还是“当前选中日同一时段”？
- 冲突提示是否需要区分“同目标重叠”和“不同目标重叠”的严重级别？
- 是否需要在后续迭代增加“批量顺延未完成计划”的批量操作能力？
