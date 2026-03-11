## Context

当前“观测目标检测与识别”链路存在三个主要入口：

- 文件导入：`src/hooks/files/useFileManager.ts` 通过 `upsertAndLinkFileTarget` 自动关联目标。
- 批量扫描：`src/hooks/targets/useTargets.ts` 中 `scanAndAutoDetect` 遍历未关联文件进行识别。
- Astrometry 同步：`src/app/astrometry/result/[id].tsx` 从 plate solve 结果构造候选并写回目标库。

这些入口虽复用了部分 store API，但名称规范化、别名处理、坐标匹配与冲突处理并未统一：`targetManager`、`targetMatcher`、`useTargets`、`syncToTarget` 各自维护匹配细节，导致行为不一致（同一输入在不同入口可能得到不同结果），并增加重复目标和误匹配风险。

## Goals / Non-Goals

**Goals:**

- 建立统一的目标识别与匹配管线，让导入、扫描、astrometry 同步共享同一套判定逻辑。
- 提升识别准确率，降低重复目标创建和错误关联概率。
- 给出可解释的识别结果（新增、更新、跳过、冲突待确认），便于用户复核与测试验证。
- 保持现有数据结构兼容，不引入破坏性存储迁移。

**Non-Goals:**

- 不引入外部在线天体目录查询或云端识别服务。
- 不重构目标页整体 UI 信息架构，仅做必要反馈增强。
- 不变更备份格式与恢复协议。
- 不在本次变更中处理历史全量数据自动清洗（仅覆盖新触发的识别流程）。

## Decisions

### 1. 引入统一识别核心（Target Resolution Core）

- Decision: 新增统一的识别核心模块（建议放在 `src/lib/targets/`，如 `targetResolution.ts`），封装候选生成、评分、冲突判定和结果分类；各入口仅传入上下文与元数据。
- Rationale: 统一规则来源，避免逻辑散落在 hook/UI 层导致偏差；核心逻辑可独立单测并被多入口复用。
- Alternatives considered:
  - 继续在各入口分别优化匹配逻辑：短期改动小，但长期维护成本高，且一致性无法保证。
  - 只在 store 层“兜底”：仍无法覆盖 UI 层先行判断与提示差异。

### 2. 采用“规范化 + 别名扩展 + 多信号评分”的匹配模型

- Decision: 匹配流程按顺序进行：名称规范化（catalog 编号标准化）→ 别名扩展（已知映射）→ 候选目标收集 → 综合评分（名称/别名命中、坐标邻近）→ 输出结果类型。
- Rationale: 当前“first match wins”容易因输入格式差异产生误判；多信号评分可以在保证自动化率的同时降低误绑概率。
- Alternatives considered:
  - 纯名称匹配：会忽略坐标上下文，误匹配率高。
  - 纯坐标匹配：缺乏命名约束，密集天区误匹配风险更高。

### 3. 明确自动关联边界：高置信自动、低置信跳过

- Decision: 识别结果分为 `linked-existing`、`created-new`、`updated-existing`、`ambiguous`、`skipped`。仅对高置信候选自动执行写入；当候选并列或证据不足时返回 `ambiguous/skipped` 并保留原因。
- Rationale: 当前流程在不确定场景仍可能自动写入，后续修复成本高；显式边界能提高可预测性。
- Alternatives considered:
  - 遇到冲突时随机/首个候选落库：不可解释且风险高。
  - 全部要求人工确认：准确但会明显牺牲批量效率。

### 4. 坐标判定逻辑集中并可调，默认保持兼容

- Decision: 坐标匹配统一为单一工具函数，默认半径沿用现有兼容值（0.5 deg）作为基础阈值，并在识别核心中统一使用；后续可扩展为按来源或信号强度差异化阈值。
- Rationale: 当前同类逻辑在 `useTargets` 与 `syncToTarget` 分散实现，参数难以统一回归。
- Alternatives considered:
  - 各入口自定义阈值：灵活但不可控，测试矩阵爆炸。
  - 立即引入复杂动态阈值模型：收益不确定，首期风险与成本偏高。

### 5. 入口层只消费结果，不重复决策

- Decision: `useFileManager`、`scanAndAutoDetect`、`astrometry result` 页面只调用统一识别核心并处理返回结果（计数、提示、写入），不再实现本地匹配分支。
- Rationale: 降低重复逻辑与回归点；新增场景时可直接复用核心。
- Alternatives considered:
  - 保留现有分支并逐步替换：过渡期行为不一致，排查困难。

### 6. 补充覆盖“跨入口一致性”的测试策略

- Decision: 增加识别核心单测 + 入口集成级用例，覆盖同一输入在导入/扫描/astrometry 三条路径下得到一致结果。
- Rationale: 本变更核心价值是“一致性”；仅测单模块无法防止入口分叉回归。
- Alternatives considered:
  - 只补 lib 层测试：无法确保 UI/hook 接线未偏离规范。

## Risks / Trade-offs

- [Risk] 匹配阈值收紧后，自动关联数下降，用户感知为“识别变少”  
  → Mitigation: 输出明确跳过原因与统计，保证可解释；必要时在后续迭代调优阈值。

- [Risk] 别名映射覆盖不足导致漏识别  
  → Mitigation: 把别名扩展保持可维护结构并补充测试样例，允许后续增量扩展映射集。

- [Risk] 扫描大量文件时匹配计算开销上升  
  → Mitigation: 复用现有索引能力（名称索引/目标索引）减少全量线性扫描，并通过批量扫描回归测试监控耗时。

- [Trade-off] 采用“低置信跳过”会增加少量人工确认工作  
  → Mitigation: 以避免误关联为优先，并在结果反馈中给出可操作原因，减少排查成本。

## Migration Plan

1. 新增统一识别核心与测试（名称规范化、别名扩展、评分和结果分类）。
2. 重构 `upsertAndLinkFileTarget` 使其依赖识别核心，不再内嵌分散匹配逻辑。
3. 接入导入、批量扫描、astrometry 同步入口，统一处理返回状态与统计。
4. 更新 i18n 文案与必要提示 UI，暴露 `ambiguous/skipped` 等结果反馈。
5. 执行 `pnpm typecheck && pnpm lint && pnpm test`；若出现大面积识别回归，可按入口逐步回退到旧逻辑并保留核心模块以便二次切换。

## Open Questions

- `ambiguous` 场景是否需要立即提供“候选目标快速选择”交互，还是先以跳过+提示落地？
- 坐标匹配半径是否需要开放为用户可配置项，还是保持内部策略统一管理？
- 是否需要在后续单独 change 中提供“历史目标去重修复”离线任务？
