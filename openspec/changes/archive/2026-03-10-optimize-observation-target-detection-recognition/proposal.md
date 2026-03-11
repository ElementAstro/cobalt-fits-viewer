## Why

现有目标检测与识别流程分散在导入、批量扫描和 astrometry 同步多个入口，名称规范化与匹配口径不一致，导致重复目标、误匹配和识别结果不稳定。随着观测文件和目标库持续增长，需要统一识别规则并提升匹配准确率，减少后续手动清理成本。

## What Changes

- 统一目标识别入口：让文件导入自动识别、`scanAndAutoDetect` 和 astrometry 同步共享同一套名称规范化与候选匹配策略。
- 增强名称识别能力：扩展目标名称标准化和别名归一逻辑，覆盖常见编号格式差异（如 `M31/M 31`、`NGC224/NGC 224`）与已知目录别名映射。
- 优化匹配策略：在名称/别名匹配基础上结合坐标邻近规则，明确“可自动关联”与“需人工确认”的边界，降低误绑到错误目标的概率。
- 强化识别反馈：完善扫描/同步结果统计与提示信息，明确新增目标、更新已有目标和跳过项的原因，便于用户快速复核。
- 补齐回归测试：为核心识别与匹配路径增加单测，覆盖重复目标防回归、跨入口一致性和边界输入。

## Capabilities

### New Capabilities

- `observation-target-detection-recognition`: 定义观测目标在导入、批量扫描与 astrometry 同步场景下的统一检测、识别、匹配与反馈行为要求。

### Modified Capabilities

- None.

## Impact

- Affected code: `src/lib/targets/targetManager.ts`, `src/lib/targets/targetMatcher.ts`, `src/lib/targets/targetRelations.ts`, `src/hooks/targets/useTargets.ts`, `src/app/astrometry/result/[id].tsx`, `src/hooks/files/useFileManager.ts`, related tests.
- Affected behavior: 自动目标识别、目标去重与关联策略、astrometry 结果同步到目标库的判定规则、批量扫描结果反馈。
- Dependencies/systems: Zustand target/file/session stores, i18n 文案（targets/astrometry），Jest 单元与 hook 测试。
