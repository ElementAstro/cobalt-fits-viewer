import type { PixelMathValidationError } from "./types";

const BUILTIN_FUNCTIONS = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  sqrt: (x: number) => Math.sqrt(Math.max(0, x)),
  log: (x: number) => Math.log1p(Math.max(0, x)),
  ln: (x: number) => Math.log(Math.max(1e-10, x)),
  log10: (x: number) => Math.log10(Math.max(1e-10, x)),
  exp: (x: number) => Math.exp(Math.min(20, x)),
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  atan2: Math.atan2,
  pow: Math.pow,
  clamp: (v: number, lo: number = 0, hi: number = 1) => Math.max(lo, Math.min(hi, v)),
  avg: (a: number, b: number) => (a + b) * 0.5,
  floor: Math.floor,
  ceil: Math.ceil,
  round: (v: number, precision: number = 1) => Math.round(v * precision) / precision,
  iif: (cond: number, ifTrue: number, ifFalse: number = 0) => (cond > 0 ? ifTrue : ifFalse),
};

type BuiltinFunctionName = keyof typeof BUILTIN_FUNCTIONS;

export interface PixelMathProgram {
  r: string;
  g: string;
  b: string;
}

export interface PixelMathApplyInput {
  width: number;
  height: number;
  base: {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
  };
  layerMonos?: Float32Array[];
  layerRgbs?: Array<{ r: Float32Array; g: Float32Array; b: Float32Array }>;
}

interface CompiledExpression {
  source: string;
  fn: (ctx: Record<string, number>, fns: typeof BUILTIN_FUNCTIONS) => number;
}

function normalizeExpression(expression: string) {
  return expression.replace(/\^/g, "**").trim();
}

function findIdentifiers(expression: string): Array<{ token: string; index: number }> {
  const output: Array<{ token: string; index: number }> = [];
  const regex = /[A-Za-z_][A-Za-z0-9_]*/g;
  let match: RegExpExecArray | null = regex.exec(expression);
  while (match) {
    output.push({ token: match[0], index: match.index });
    match = regex.exec(expression);
  }
  return output;
}

function hasBalancedParens(expression: string) {
  let depth = 0;
  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i];
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export function validatePixelMathExpression(
  expression: string,
  allowedVariables: ReadonlySet<string>,
): PixelMathValidationError | null {
  const source = normalizeExpression(expression);
  if (source.length === 0) {
    return {
      channel: "r",
      message: "Expression is empty",
      expression,
      index: 0,
    };
  }

  if (!hasBalancedParens(source)) {
    return {
      channel: "r",
      message: "Parentheses are not balanced",
      expression,
      index: 0,
    };
  }

  if (/[^0-9A-Za-z_\s+\-*/%^().,<>!=&|?:]/.test(source)) {
    return {
      channel: "r",
      message: "Expression contains unsupported characters",
      expression,
      index: 0,
    };
  }

  const identifiers = findIdentifiers(source);
  for (const id of identifiers) {
    if (
      (BUILTIN_FUNCTIONS as Partial<Record<string, unknown>>)[id.token] !== undefined ||
      id.token === "PI" ||
      id.token === "E" ||
      allowedVariables.has(id.token)
    ) {
      continue;
    }
    return {
      channel: "r",
      message: `Unknown identifier: ${id.token}`,
      expression,
      index: id.index,
    };
  }

  return null;
}

function compileExpression(source: string): CompiledExpression {
  const normalized = normalizeExpression(source);
  const fn = new Function(
    "ctx",
    "fns",
    "const PI = Math.PI; const E = Math.E; with(fns){ with(ctx){ return (" + normalized + "); } }",
  ) as (ctx: Record<string, number>, fns: typeof BUILTIN_FUNCTIONS) => number;

  return { source: normalized, fn };
}

function buildAllowedVariables(layerCount: number) {
  const allowed = new Set<string>(["R", "G", "B"]);
  for (let i = 1; i <= layerCount; i++) {
    allowed.add(`L${i}`);
    allowed.add(`R${i}`);
    allowed.add(`G${i}`);
    allowed.add(`B${i}`);
  }
  return allowed;
}

export function validatePixelMathProgram(
  program: PixelMathProgram,
  layerCount: number,
): PixelMathValidationError[] {
  const allowed = buildAllowedVariables(layerCount);
  const errors: PixelMathValidationError[] = [];

  const channels: Array<{ key: "r" | "g" | "b"; expr: string }> = [
    { key: "r", expr: program.r },
    { key: "g", expr: program.g },
    { key: "b", expr: program.b },
  ];

  for (const channel of channels) {
    const error = validatePixelMathExpression(channel.expr, allowed);
    if (error) {
      errors.push({ ...error, channel: channel.key });
    }
  }

  return errors;
}

export function applyPixelMathProgram(
  input: PixelMathApplyInput,
  program: PixelMathProgram,
): {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  error?: PixelMathValidationError;
} {
  const layerMonos = input.layerMonos ?? [];
  const layerRgbs = input.layerRgbs ?? [];
  const layerCount = Math.max(layerMonos.length, layerRgbs.length);

  const validationErrors = validatePixelMathProgram(program, layerCount);
  if (validationErrors.length > 0) {
    return {
      r: input.base.r,
      g: input.base.g,
      b: input.base.b,
      error: validationErrors[0],
    };
  }

  let compiledR: CompiledExpression;
  let compiledG: CompiledExpression;
  let compiledB: CompiledExpression;

  try {
    compiledR = compileExpression(program.r);
    compiledG = compileExpression(program.g);
    compiledB = compileExpression(program.b);
  } catch (error) {
    return {
      r: input.base.r,
      g: input.base.g,
      b: input.base.b,
      error: {
        channel: "r",
        message: error instanceof Error ? error.message : "Failed to compile expression",
        expression: program.r,
        index: 0,
      },
    };
  }

  const total = input.width * input.height;
  const outR = new Float32Array(total);
  const outG = new Float32Array(total);
  const outB = new Float32Array(total);

  const ctx: Record<string, number> = {};

  for (let i = 0; i < total; i++) {
    ctx.R = input.base.r[i];
    ctx.G = input.base.g[i];
    ctx.B = input.base.b[i];

    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
      const n = layerIdx + 1;
      const mono = layerMonos[layerIdx];
      const rgb = layerRgbs[layerIdx];

      ctx[`L${n}`] = mono ? mono[i] : 0;
      ctx[`R${n}`] = rgb ? rgb.r[i] : mono ? mono[i] : 0;
      ctx[`G${n}`] = rgb ? rgb.g[i] : mono ? mono[i] : 0;
      ctx[`B${n}`] = rgb ? rgb.b[i] : mono ? mono[i] : 0;
    }

    try {
      const r = compiledR.fn(ctx, BUILTIN_FUNCTIONS);
      const g = compiledG.fn(ctx, BUILTIN_FUNCTIONS);
      const b = compiledB.fn(ctx, BUILTIN_FUNCTIONS);

      outR[i] = Number.isFinite(r) ? r : 0;
      outG[i] = Number.isFinite(g) ? g : 0;
      outB[i] = Number.isFinite(b) ? b : 0;
    } catch (error) {
      const row = Math.floor(i / input.width) + 1;
      const column = (i % input.width) + 1;
      return {
        r: input.base.r,
        g: input.base.g,
        b: input.base.b,
        error: {
          channel: "r",
          message: error instanceof Error ? error.message : "PixelMath execution failed",
          expression: program.r,
          index: 0,
          row,
          column,
        },
      };
    }
  }

  return { r: outR, g: outG, b: outB };
}

export const PIXEL_MATH_FUNCTIONS: BuiltinFunctionName[] = Object.keys(
  BUILTIN_FUNCTIONS,
) as BuiltinFunctionName[];
