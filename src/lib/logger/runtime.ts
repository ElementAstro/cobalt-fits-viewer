import { Logger } from "./logger";
import { LOG_TAGS } from "./tags";

type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
  __cobaltLoggerHookInstalled?: boolean;
};

let initPromise: Promise<void> | null = null;
let hooksInstalled = false;
let unhandledRejectionCleanup: (() => void) | null = null;

function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === "string") return new Error(reason);
  return new Error(`Unhandled rejection: ${JSON.stringify(reason)}`);
}

function installGlobalExceptionHandler() {
  const root = globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike };
  const errorUtils = root.ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;
  if (errorUtils.__cobaltLoggerHookInstalled) return;

  const prevHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    Logger.error(LOG_TAGS.GlobalError, "Unhandled global JS exception", {
      error,
      isFatal: Boolean(isFatal),
    });

    if (typeof prevHandler === "function") {
      prevHandler(error, isFatal);
    }
  });
  errorUtils.__cobaltLoggerHookInstalled = true;
}

function installUnhandledRejectionHandler() {
  if (unhandledRejectionCleanup) return;

  if (
    typeof globalThis.addEventListener === "function" &&
    typeof globalThis.removeEventListener === "function"
  ) {
    const handler = (event: unknown) => {
      const reason = (event as { reason?: unknown } | null)?.reason;
      Logger.error(LOG_TAGS.GlobalError, "Unhandled promise rejection", toError(reason));
    };
    globalThis.addEventListener("unhandledrejection", handler as never);
    unhandledRejectionCleanup = () => {
      globalThis.removeEventListener("unhandledrejection", handler as never);
      unhandledRejectionCleanup = null;
    };
    return;
  }

  const nodeProcess = (
    globalThis as typeof globalThis & {
      process?: {
        on?: (event: string, handler: (reason: unknown) => void) => void;
        off?: (event: string, handler: (reason: unknown) => void) => void;
      };
    }
  ).process;

  if (nodeProcess?.on) {
    const handler = (reason: unknown) => {
      Logger.error(LOG_TAGS.GlobalError, "Unhandled promise rejection", toError(reason));
    };

    nodeProcess.on("unhandledRejection", handler);
    unhandledRejectionCleanup = () => {
      nodeProcess.off?.("unhandledRejection", handler);
      unhandledRejectionCleanup = null;
    };
  }
}

function installHooks() {
  if (hooksInstalled) return;
  installGlobalExceptionHandler();
  installUnhandledRejectionHandler();
  hooksInstalled = true;
}

export async function initLoggerRuntime(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await Logger.hydrate();
    } catch (error) {
      Logger.warn(LOG_TAGS.Runtime, "Logger hydration failed", error);
    }

    installHooks();
    Logger.debug(LOG_TAGS.Runtime, "Logger runtime initialized");
  })();

  return initPromise;
}
