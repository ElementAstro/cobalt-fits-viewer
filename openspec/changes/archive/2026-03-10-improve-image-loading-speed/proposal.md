## Why

当前图库在文件数量较多时，缩略图首屏可见速度明显下降。现有按需生成链路使用固定并发和逐文件完整解析，导致滚动进入页面时等待时间长、重复请求多，影响浏览效率与交互流畅度。

## What Changes

- 引入“可见区域优先”的缩略图加载策略，优先保证首屏与即将进入视口的图片快速可见。
- 重构按需生成队列，支持去重、失败冷却和分级并发，减少重复解码与主线程竞争。
- 为 FITS/栅格/视频缩略图统一加载路径，优先复用已有缓存与已在途任务，避免同一文件多次生成。
- 增加图像加载性能观测与回归测试，确保后续改动不会把加载速度拉回。

## Capabilities

### New Capabilities

- `thumbnail-loading-performance`: 定义图库缩略图加载的优先级、并发控制、去重复用与可测性能基线要求。

### Modified Capabilities

- None.

## Impact

- Affected code: `src/components/gallery/ThumbnailGrid.tsx`, `src/hooks/gallery/useThumbnailOnDemand.ts`, `src/lib/gallery/thumbnailGenerator.ts`, `src/lib/gallery/thumbnailWorkflow.ts`, related tests under `src/components/gallery/__tests__` and `src/hooks/gallery/__tests__`.
- Affected behavior: 图库首屏缩略图出现速度、滚动时加载稳定性、重复请求次数与失败重试行为。
- Dependencies/systems: Expo Image 缓存策略、Skia 缩略图编码、FITS 解析与转换链路、FlashList 渲染节奏。
