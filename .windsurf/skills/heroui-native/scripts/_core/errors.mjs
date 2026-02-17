export const EXIT_CODE = {
  OK: 0,
  INVALID_ARGS: 1,
  FAILURE: 1,
  UNAVAILABLE: 2,
};

export class SkillError extends Error {
  constructor(code, message, detail = undefined, exitCode = EXIT_CODE.FAILURE) {
    super(message);
    this.name = "SkillError";
    this.code = code;
    this.detail = detail;
    this.exitCode = exitCode;
  }
}

export function toErrorObject(error, fallbackCode = "UNKNOWN_ERROR") {
  if (error instanceof SkillError) {
    return {
      code: error.code,
      message: error.message,
      detail: error.detail,
    };
  }

  if (error && typeof error === "object") {
    const obj = error;
    return {
      code: typeof obj.code === "string" ? obj.code : fallbackCode,
      message: typeof obj.message === "string" ? obj.message : "Unknown error",
      detail: obj.detail,
    };
  }

  return {
    code: fallbackCode,
    message: String(error ?? "Unknown error"),
  };
}

export function failureEnvelope(error, options = {}) {
  return {
    ok: false,
    source: options.source ?? "api",
    data: options.data ?? null,
    error: toErrorObject(error),
    meta: options.meta ?? {},
  };
}

export function successEnvelope(data, options = {}) {
  return {
    ok: true,
    source: options.source ?? "api",
    data,
    meta: options.meta ?? {},
  };
}
