type HiPSBackend = "local" | "remote" | "auto";
type HiPSCoordsys = "icrs" | "galactic";

export interface HiPSCutoutRequest {
  hipsInput: string;
  options: {
    backend: HiPSBackend;
    hipsId?: string;
    endpoint?: string;
    endpointFallback?: string;
    timeoutMs?: number;
    cutout: {
      width: number;
      height: number;
      ra: number;
      dec: number;
      fov: number;
      projection: string;
      coordsys?: HiPSCoordsys;
      rotationAngle?: number;
    };
  };
  suggestedFilename: string;
}

function parseFiniteNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  const parsed = parseFiniteNumber(value);
  if (parsed == null) return fallback;
  const rounded = Math.round(parsed);
  if (rounded <= 0) return fallback;
  return rounded;
}

function parseBackend(value: string | null | undefined): HiPSBackend | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "local" || normalized === "remote" || normalized === "auto") {
    return normalized;
  }
  return null;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * 解析 HiPS URL 导入请求。
 * 触发条件：`hips=1` 或 URL 参数包含 `hipsId` / `hips=<id>`。
 */
export function parseHiPSCutoutRequest(inputUrl: string): HiPSCutoutRequest | null {
  const parsed = new URL(inputUrl);
  const hasHiPSFlag =
    parsed.searchParams.get("hips") === "1" ||
    parsed.searchParams.has("hipsId") ||
    (parsed.searchParams.has("hips") && parsed.searchParams.get("hips") !== "1");
  if (!hasHiPSFlag) return null;

  const hipsParam = parsed.searchParams.get("hips")?.trim() ?? "";
  const hipsId =
    parsed.searchParams.get("hipsId")?.trim() ||
    (hipsParam && hipsParam !== "1" ? hipsParam : undefined);
  const ra = parseFiniteNumber(parsed.searchParams.get("ra"));
  const dec = parseFiniteNumber(parsed.searchParams.get("dec"));
  const fov = parseFiniteNumber(parsed.searchParams.get("fov"));

  const missing: string[] = [];
  if (ra == null) missing.push("ra");
  if (dec == null) missing.push("dec");
  if (fov == null) missing.push("fov");
  if (missing.length > 0) {
    throw new Error(
      `HiPS cutout URL requires ${missing.join(", ")} query parameter(s). ` +
        `Example: ?hips=1&ra=83.63&dec=22.01&fov=1.2`,
    );
  }
  const resolvedRa = ra as number;
  const resolvedDec = dec as number;
  const resolvedFov = fov as number;

  if (resolvedFov <= 0) {
    throw new Error("HiPS cutout URL parameter `fov` must be greater than 0.");
  }

  const projection = (parsed.searchParams.get("projection") ?? "TAN").trim() || "TAN";
  const coordsysRaw = parsed.searchParams.get("coordsys")?.trim().toLowerCase();
  const coordsys: HiPSCoordsys | undefined =
    coordsysRaw === "icrs" || coordsysRaw === "galactic" ? coordsysRaw : undefined;
  const rotationAngle = parseFiniteNumber(parsed.searchParams.get("rotationAngle"));

  const backend = parseBackend(parsed.searchParams.get("backend")) ?? (hipsId ? "auto" : "local");
  if (backend === "remote" && !hipsId) {
    throw new Error("HiPS remote backend requires `hipsId` query parameter.");
  }

  const sourceRaw =
    parsed.searchParams.get("source")?.trim() ||
    parsed.searchParams.get("hipsUrl")?.trim() ||
    `${parsed.origin}${parsed.pathname}`;
  const hipsInput = sourceRaw || inputUrl;

  const width = parsePositiveInt(parsed.searchParams.get("width"), 512);
  const height = parsePositiveInt(parsed.searchParams.get("height"), 512);

  const endpoint = parsed.searchParams.get("endpoint")?.trim() || undefined;
  const endpointFallback = parsed.searchParams.get("endpointFallback")?.trim() || undefined;
  const timeoutRaw = parseFiniteNumber(parsed.searchParams.get("timeoutMs"));
  const timeoutMs =
    timeoutRaw != null && timeoutRaw > 0 ? Math.min(120_000, Math.round(timeoutRaw)) : undefined;

  const filenameToken = sanitizeFilenamePart(
    hipsId ?? parsed.searchParams.get("title") ?? "cutout",
  );
  const suggestedFilename = `hips_${filenameToken || "cutout"}.fits`;

  return {
    hipsInput,
    options: {
      backend,
      hipsId,
      endpoint,
      endpointFallback,
      timeoutMs,
      cutout: {
        width,
        height,
        ra: resolvedRa,
        dec: resolvedDec,
        fov: resolvedFov,
        projection,
        coordsys,
        rotationAngle: rotationAngle ?? undefined,
      },
    },
    suggestedFilename,
  };
}
