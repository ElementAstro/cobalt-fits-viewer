/**
 * 批量重命名引擎
 * 支持基于 FITS 元数据的模板变量
 */

import type { FitsMetadata } from "../fits/types";

/**
 * 支持的模板变量:
 * {object}    - 目标名 (e.g. M42)
 * {date}      - 观测日期 YYYY-MM-DD
 * {time}      - 观测时间 HH-MM-SS
 * {filter}    - 滤镜 (e.g. Ha, OIII)
 * {exptime}   - 曝光时间秒数
 * {frameType} - 帧类型 (如 light/dark/flat/bias/darkflat/自定义)
 * {telescope} - 望远镜
 * {camera}    - 相机/仪器
 * {gain}      - 增益
 * {seq}       - 序号 (自动补零)
 * {original}  - 原始文件名 (不含扩展名)
 */

const DEFAULT_TEMPLATE = "{object}_{filter}_{exptime}s_{seq}";

/**
 * 从模板和元数据生成新文件名
 */
export function generateFilename(
  meta: FitsMetadata,
  template: string,
  index: number,
  totalDigits: number = 3,
): string {
  const dateStr = meta.dateObs ? meta.dateObs.split("T")[0] : "unknown-date";
  const timeStr = meta.dateObs
    ? (meta.dateObs.split("T")[1] ?? "")
        .replace(/[Z+].*/i, "")
        .replace(/:/g, "-")
        .split(".")[0]
    : "";
  const originalBase = meta.filename.replace(/\.[^.]+$/, "");
  const ext = meta.filename.match(/\.[^.]+$/)?.[0] ?? ".fits";

  const result = template
    .replace(/\{object\}/gi, sanitize(meta.object ?? "unknown"))
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{time\}/gi, timeStr || "unknown-time")
    .replace(/\{filter\}/gi, sanitize(meta.filter ?? "nofilter"))
    .replace(/\{exptime\}/gi, meta.exptime != null ? String(meta.exptime) : "0")
    .replace(/\{frameType\}/gi, meta.frameType ?? "unknown")
    .replace(/\{telescope\}/gi, sanitize(meta.telescope ?? ""))
    .replace(/\{camera\}/gi, sanitize(meta.instrument ?? meta.detector ?? ""))
    .replace(/\{gain\}/gi, meta.gain != null ? String(meta.gain) : "")
    .replace(/\{seq\}/gi, String(index + 1).padStart(totalDigits, "0"))
    .replace(/\{original\}/gi, originalBase);

  return result + ext;
}

/**
 * 预览批量重命名结果
 */
export function previewRenames(
  files: FitsMetadata[],
  template: string,
): Array<{ id: string; oldName: string; newName: string }> {
  const digits = String(files.length).length;
  return files.map((f, i) => ({
    id: f.id,
    oldName: f.filename,
    newName: generateFilename(f, template, i, Math.max(3, digits)),
  }));
}

/**
 * 获取所有可用的模板变量
 */
export function getTemplateVariables(): Array<{ key: string; label: string; example: string }> {
  return [
    { key: "{object}", label: "Object", example: "M42" },
    { key: "{date}", label: "Date", example: "2024-01-15" },
    { key: "{time}", label: "Time", example: "22-30-00" },
    { key: "{filter}", label: "Filter", example: "Ha" },
    { key: "{exptime}", label: "Exposure", example: "300" },
    { key: "{frameType}", label: "Frame Type", example: "light" },
    { key: "{telescope}", label: "Telescope", example: "RC8" },
    { key: "{camera}", label: "Camera", example: "ASI294MM" },
    { key: "{gain}", label: "Gain", example: "100" },
    { key: "{seq}", label: "Sequence #", example: "001" },
    { key: "{original}", label: "Original Name", example: "IMG_0001" },
  ];
}

export { DEFAULT_TEMPLATE };

/**
 * 清理文件名中的非法字符
 */
function sanitize(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "_";
}
