/**
 * 通用计时器 Hook
 * 根据开始时间和激活状态返回格式化的经过时间字符串
 */

import { useEffect, useState } from "react";
import { formatDuration } from "../../lib/astrometry/formatUtils";

export function useElapsedTime(
  startTime: number,
  isActive: boolean,
  formatFn: (ms: number) => string = formatDuration,
): string {
  const [elapsed, setElapsed] = useState(isActive ? Date.now() - startTime : 0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [startTime, isActive]);

  return formatFn(elapsed);
}
