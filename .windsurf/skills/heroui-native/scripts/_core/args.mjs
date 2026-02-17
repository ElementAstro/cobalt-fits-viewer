import { EXIT_CODE, SkillError } from "./errors.mjs";

const DEFAULTS = {
  format: "text",
  timeoutMs: 30000,
  fallback: "auto",
  verbose: false,
};

function readOptionValue(argv, index, current) {
  if (current.includes("=")) {
    return { value: current.slice(current.indexOf("=") + 1), nextIndex: index };
  }

  if (index + 1 >= argv.length) {
    return { value: undefined, nextIndex: index };
  }

  return { value: argv[index + 1], nextIndex: index + 1 };
}

export function parseCommonArgs(argv, options = {}) {
  const minPositionals = options.minPositionals ?? 0;
  const usage = options.usage ?? "Usage: <script> [options]";
  const positionals = [];
  const parsed = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }

    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }

    if (token === "--json") {
      parsed.format = "json";
      continue;
    }

    if (token === "--verbose") {
      parsed.verbose = true;
      continue;
    }

    if (token.startsWith("--format")) {
      const { value, nextIndex } = readOptionValue(argv, i, token);
      i = nextIndex;
      if (value !== "text" && value !== "json") {
        throw new SkillError(
          "INVALID_ARGS",
          `Invalid --format value: ${value ?? "<missing>"}`,
          { usage },
          EXIT_CODE.INVALID_ARGS,
        );
      }
      parsed.format = value;
      continue;
    }

    if (token.startsWith("--timeout")) {
      const { value, nextIndex } = readOptionValue(argv, i, token);
      i = nextIndex;
      const timeout = Number(value);
      if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new SkillError(
          "INVALID_ARGS",
          `Invalid --timeout value: ${value ?? "<missing>"}`,
          { usage },
          EXIT_CODE.INVALID_ARGS,
        );
      }
      parsed.timeoutMs = timeout;
      continue;
    }

    if (token.startsWith("--api-base")) {
      const { value, nextIndex } = readOptionValue(argv, i, token);
      i = nextIndex;
      if (!value) {
        throw new SkillError(
          "INVALID_ARGS",
          "Missing value for --api-base",
          { usage },
          EXIT_CODE.INVALID_ARGS,
        );
      }
      parsed.apiBase = value;
      continue;
    }

    if (token.startsWith("--fallback")) {
      const { value, nextIndex } = readOptionValue(argv, i, token);
      i = nextIndex;
      if (value !== "auto" && value !== "never" && value !== "only") {
        throw new SkillError(
          "INVALID_ARGS",
          `Invalid --fallback value: ${value ?? "<missing>"}`,
          { usage },
          EXIT_CODE.INVALID_ARGS,
        );
      }
      parsed.fallback = value;
      continue;
    }

    throw new SkillError(
      "INVALID_ARGS",
      `Unknown option: ${token}`,
      { usage },
      EXIT_CODE.INVALID_ARGS,
    );
  }

  if (!parsed.help && positionals.length < minPositionals) {
    throw new SkillError(
      "INVALID_ARGS",
      `Expected at least ${minPositionals} positional argument(s)`,
      { usage },
      EXIT_CODE.INVALID_ARGS,
    );
  }

  return {
    ...parsed,
    positionals,
    usage,
  };
}
