## Context

当前代码已经有 `useScreenOrientation` 与 `useResponsiveLayout`，并通过 `layoutMode` 区分 `portrait`、`landscape-phone`、`landscape-tablet`。但各页面与组件仍存在以下问题：

- 横屏规则分散，部分组件直接消费 `isLandscape`，部分组件依赖 `isLandscapeTablet`，导致行为不一致。
- 相同类型 UI（如 header、filter bar、toolbar）在不同页面使用不同间距与隐藏策略，横屏体验割裂。
- 横屏验证覆盖不足，主要集中在少数页面，难以防止后续回归。

该变更是跨 `src/app` 路由层、`src/components` 复用组件层、`src/hooks/common` 布局判定层的横切改动，需要先明确统一设计与验收边界。

## Goals / Non-Goals

**Goals:**

- 建立统一的横屏适配契约，确保页面和复用组件在相同 layout mode 下采用一致规则。
- 按组件/页面清单逐项完成横屏检查与修复，消除裁切、重叠、操作不可达、信息层级混乱等问题。
- 为横屏关键路径补充自动化验证，确保修复可持续。

**Non-Goals:**

- 不引入新的导航结构或业务流程。
- 不修改现有 orientation lock 设置模型（`default` / `portrait` / `landscape`）。
- 不对所有视觉细节做品牌重设计，仅处理横屏可用性与一致性问题。

## Decisions

### 1. 以 `layoutMode` 作为横屏行为主判定，减少页面级自定义分叉

- Decision: 页面与组件优先基于 `layoutMode`（含 `landscape-phone` / `landscape-tablet`）进行布局分支，避免仅用布尔值导致能力丢失。
- Rationale: 当前系统已提供 `getLayoutMode`，可直接复用并统一行为。
- Alternative considered: 继续允许各页面独立组合 `isLandscape` 与屏幕宽度阈值；被拒绝，因为会继续产生重复逻辑与不一致。

### 2. 建立“页面容器 + 组件适配”两层修复顺序

- Decision: 先修复路由页面容器层（安全区、padding、双栏/侧栏、滚动区域），再修复内部复用组件（header、toolbar、filter、card 列表等）。
- Rationale: 先稳定容器约束，组件修复才不会反复返工。
- Alternative considered: 按文件随机修复；被拒绝，因为依赖关系复杂，回归风险高。

### 3. 为横屏适配定义统一验收清单并映射到测试

- Decision: 每个目标页面/组件至少验证四类项：可见性、可触达性、可滚动性、信息层级；并把关键场景沉淀为 Jest 用例与 route parity 检查。
- Rationale: 把“逐个组件检查”转成结构化验收，避免人工口径漂移。
- Alternative considered: 仅人工自测；被拒绝，因为难以长期维持。

### 4. 增量交付，按风险顺序推进

- Decision: 优先高频入口（Tabs 首页、Gallery、Sessions、Targets、Viewer/Video），再覆盖次级页面与公共组件。
- Rationale: 在有限迭代中先降低用户可感知问题。
- Alternative considered: 一次性全量改造；被拒绝，因为改动面太大且难定位回归。

## Risks / Trade-offs

- [Risk] 横屏压缩导致文本被过度截断或控件挤压  
  → Mitigation: 对关键操作区设置最小点击尺寸与最小可见字段，必要时使用折叠/二级入口而非硬压缩。

- [Risk] 统一规则后，个别页面原有“特例优化”被覆盖  
  → Mitigation: 允许少量白名单特例，但必须在组件注释和测试中声明原因。

- [Risk] 测试数量增加拉长 CI 时间  
  → Mitigation: 以关键路径场景为主，避免重复断言；将重型场景留给 e2e parity。

- [Trade-off] 增加前期审计与重构成本，换取后续新增页面复用一致策略  
  → Mitigation: 通过任务分阶段交付，优先完成高影响页面。

## Migration Plan

1. 建立横屏检查清单并圈定首批页面/组件。
2. 先改造公共布局判定与页面容器层，统一横屏分支入口。
3. 逐个组件修复横屏布局并同步补测。
4. 运行 `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e:parity` 验证。
5. 如出现回归，按页面粒度回滚对应提交，不回滚已验证通过的独立模块。

## Open Questions

- 是否需要把横屏检查清单沉淀为仓库内长期维护文档（例如 `docs/testing/landscape-checklist.md`）？
- 低频页面（如部分详情页）是否本次纳入全量覆盖，还是作为后续批次？
