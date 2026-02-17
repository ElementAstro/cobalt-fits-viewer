import { SkillError, EXIT_CODE } from "./errors.mjs";

const DEFAULT_API_BASE = "https://native-mcp-api.heroui.com";
const DEFAULT_USER_AGENT = "HeroUI-Native-Skill/2.0";

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function readBodyAsText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function createHttpClient(options = {}) {
  const apiBase = options.apiBase ?? process.env.HEROUI_NATIVE_API_BASE ?? DEFAULT_API_BASE;
  const appParam = options.appParam ?? "app=native-skills";
  const timeoutMs = options.timeoutMs ?? 30000;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  function buildApiUrl(endpoint) {
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${apiBase}${endpoint}${separator}${appParam}`;
  }

  async function request(url, requestOptions = {}) {
    const timer = createTimeoutSignal(requestOptions.timeoutMs ?? timeoutMs);

    try {
      const response = await fetch(url, {
        method: requestOptions.method ?? "GET",
        headers: {
          "User-Agent": userAgent,
          ...(requestOptions.headers ?? {}),
        },
        body: requestOptions.body,
        signal: timer.signal,
      });

      if (!response.ok) {
        const body = await readBodyAsText(response);
        throw new SkillError(
          "HTTP_ERROR",
          `HTTP ${response.status}: ${response.statusText}`,
          {
            status: response.status,
            statusText: response.statusText,
            url,
            body: body.slice(0, 300),
          },
          EXIT_CODE.FAILURE,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof SkillError) {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw new SkillError(
          "TIMEOUT",
          `Request timeout after ${requestOptions.timeoutMs ?? timeoutMs}ms`,
          { url },
          EXIT_CODE.UNAVAILABLE,
        );
      }

      throw new SkillError("NETWORK_ERROR", "Network request failed", { url, cause: String(error) });
    } finally {
      timer.clear();
    }
  }

  async function getJsonFromApi(endpoint, requestOptions = {}) {
    const url = buildApiUrl(endpoint);
    const response = await request(url, requestOptions);
    return response.json();
  }

  async function getText(url, requestOptions = {}) {
    const response = await request(url, requestOptions);
    return response.text();
  }

  return {
    apiBase,
    appParam,
    timeoutMs,
    buildApiUrl,
    request,
    getJsonFromApi,
    getText,
  };
}
