## Context

当前图库缩略图加载依赖 `ThumbnailGrid -> useThumbnailOnDemand -> regenerateFileThumbnail` 链路。该链路存在三个性能瓶颈：

- 队列仅有固定并发（`ON_DEMAND_CONCURRENCY = 2`），无法区分首屏与离屏任务优先级。
- 请求去重范围局限在单个 hook 实例，跨页面/弹层或快速滚动时会出现同一文件重复入队。
- 单个任务对 FITS 文件执行完整解析与转换，重负载任务与轻负载任务在同一队列竞争，导致首屏可见时间抖动。

该改动横跨 `src/components/gallery`、`src/hooks/gallery`、`src/lib/gallery`，属于跨模块性能改造，需要先明确调度策略、边界与回归验证方式。

## Goals / Non-Goals

**Goals:**

- 缩短图库首屏缩略图“可见时间”，优先保障当前视口和即将进入视口的文件。
- 避免同一文件被重复生成缩略图，统一复用在途任务与缓存结果。
- 在不牺牲交互流畅性的前提下提高吞吐，确保并发可控并可回归验证。

**Non-Goals:**

- 不改变图库筛选、排序、分组等业务规则。
- 不引入新的远程图片服务或云端缩略图依赖。
- 不重写 FITS 解码算法，仅优化其调度与调用方式。

## Decisions

### 1. 引入“视口优先”的多级任务队列

- Decision: 将缩略图任务拆分为 `visible`、`nearby`、`background` 三个优先级队列，调度时始终先消费高优先级队列。
- Rationale: 用户感知速度主要取决于首屏和即将滚入区域，优先级队列可直接改善可见等待时间。
- Alternative considered: 维持 FIFO 单队列并仅提高并发；被拒绝，因为会放大设备负载且无法保证首屏优先。

### 2. 采用全局在途任务注册表实现跨实例去重

- Decision: 在图库缩略图域建立模块级任务注册表（按 `fileId` 键控），新请求先复用在途 Promise，任务完成后再释放。
- Rationale: `ThumbnailGrid`、`QuickLookModal` 等入口可能并发请求同一文件，跨实例去重是消除重复生成的最低成本方案。
- Alternative considered: 仅在 hook 内 Set 去重；被拒绝，因为只能覆盖单实例，无法防止跨组件重复。

### 3. 并发改为“有上限的分级并发”而非固定值

- Decision: 将并发控制改为可配置上限，并在调度层限制重负载任务（FITS/视频）抢占全部 worker。
- Rationale: 固定并发 2 在大批量场景吞吐不足，而无分类提并发会导致主线程竞争；分级并发可平衡速度与稳定性。
- Alternative considered: 单一高并发（例如 6）；被拒绝，因为高端设备受益但中低端设备更容易卡顿。

### 4. 保留失败冷却并加入可重试窗口与可观测指标

- Decision: 延续失败冷却机制，记录最近失败时间与重试次数，并暴露队列长度、活跃任务数、去重命中数供日志与测试断言。
- Rationale: 性能改造必须可观测，否则难以判断是否回退；冷却策略能避免失败文件造成抖动风暴。
- Alternative considered: 失败立即重试直至成功；被拒绝，因为会放大 I/O 与解析开销，拖慢整体加载。

## Risks / Trade-offs

- [Risk] 优先级调度导致离屏任务完成更慢  
  → Mitigation: 为 `background` 队列保留最小吞吐配额，避免长期饥饿。

- [Risk] 全局任务注册表若清理不当可能造成内存滞留  
  → Mitigation: 在任务 `finally` 中强制释放，并为异常路径增加单元测试覆盖。

- [Risk] 并发参数不适配全部设备，可能出现局部卡顿  
  → Mitigation: 默认保守阈值 + 设置层可调，先以真实设备数据迭代。

- [Trade-off] 增加调度逻辑复杂度，换取可见加载速度与稳定性提升  
  → Mitigation: 将调度职责下沉到独立模块，保持 UI 组件最小改动面。

## Migration Plan

1. 新增缩略图调度模块并接入 `useThumbnailOnDemand`，保证行为向后兼容。
2. 在 `ThumbnailGrid` 注入视口优先级信号（可见项与预取项），替换原始单入口请求方式。
3. 增加/更新单元测试，覆盖优先级调度、跨实例去重、失败冷却与并发上限。
4. 通过 `pnpm test`（必要时补跑 `pnpm typecheck`）验证改动稳定后再进入实现阶段。
5. 若线上/灰度观察出现回归，按模块开关回退到旧队列策略。

## Open Questions

- 并发上限是否需要按平台（iOS/Android/Web）区分默认值？
- 是否将性能指标接入现有设置页诊断面板，供用户自助上报？
