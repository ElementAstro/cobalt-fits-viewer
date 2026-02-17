describe("logger runtime", () => {
  const originalAddEventListener = (globalThis as { addEventListener?: unknown }).addEventListener;
  const originalRemoveEventListener = (globalThis as { removeEventListener?: unknown })
    .removeEventListener;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = undefined;
    (globalThis as { addEventListener?: unknown }).addEventListener = originalAddEventListener;
    (globalThis as { removeEventListener?: unknown }).removeEventListener =
      originalRemoveEventListener;
  });

  it("hydrates once and is idempotent", async () => {
    const hydrate = jest.fn(async () => undefined);
    const debug = jest.fn();
    const warn = jest.fn();
    const error = jest.fn();

    jest.doMock("../logger", () => ({
      Logger: { hydrate, debug, warn, error },
    }));

    const { initLoggerRuntime } = require("../runtime") as {
      initLoggerRuntime: () => Promise<void>;
    };

    await Promise.all([initLoggerRuntime(), initLoggerRuntime()]);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalled();
  });

  it("forwards global js exceptions to logger", async () => {
    const hydrate = jest.fn(async () => undefined);
    const debug = jest.fn();
    const warn = jest.fn();
    const error = jest.fn();

    const previousHandler = jest.fn();
    const setGlobalHandler = jest.fn();
    (globalThis as typeof globalThis & { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => previousHandler,
      setGlobalHandler,
    };

    jest.doMock("../logger", () => ({
      Logger: { hydrate, debug, warn, error },
    }));

    const { initLoggerRuntime } = require("../runtime") as {
      initLoggerRuntime: () => Promise<void>;
    };
    await initLoggerRuntime();

    const boom = new Error("boom");
    const invokeHandler = setGlobalHandler.mock.calls[0]?.[0] as
      | ((error: Error, isFatal?: boolean) => void)
      | undefined;
    expect(invokeHandler).toBeDefined();
    invokeHandler?.(boom, true);

    expect(error).toHaveBeenCalledWith(
      "GlobalError",
      "Unhandled global JS exception",
      expect.objectContaining({ error: boom, isFatal: true }),
    );
    expect(previousHandler).toHaveBeenCalledWith(boom, true);
  });

  it("logs unhandled promise rejections via global event listener", async () => {
    const hydrate = jest.fn(async () => undefined);
    const debug = jest.fn();
    const warn = jest.fn();
    const error = jest.fn();
    const add = jest.fn();
    const remove = jest.fn();

    (
      globalThis as typeof globalThis & {
        addEventListener?: unknown;
        removeEventListener?: unknown;
      }
    ).addEventListener = add;
    (
      globalThis as typeof globalThis & {
        addEventListener?: unknown;
        removeEventListener?: unknown;
      }
    ).removeEventListener = remove;

    jest.doMock("../logger", () => ({
      Logger: { hydrate, debug, warn, error },
    }));

    const { initLoggerRuntime } = require("../runtime") as {
      initLoggerRuntime: () => Promise<void>;
    };
    await initLoggerRuntime();

    const handler = add.mock.calls.find((call) => call[0] === "unhandledrejection")?.[1] as
      | ((event: { reason?: unknown }) => void)
      | undefined;
    expect(handler).toBeDefined();

    handler?.({ reason: new Error("reject boom") });
    expect(error).toHaveBeenCalledWith(
      "GlobalError",
      "Unhandled promise rejection",
      expect.any(Error),
    );
  });
});
