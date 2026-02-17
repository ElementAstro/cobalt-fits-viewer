import { Logger } from "../logger";

describe("Logger", () => {
  beforeEach(() => {
    Logger.clear();
    Logger.configure({
      maxEntries: 500,
      minLevel: "debug",
      consoleOutput: false,
    });
  });

  it("notifies subscribers when entries are added and cleared", () => {
    const listener = jest.fn();
    const unsubscribe = Logger.subscribe(listener);

    Logger.info("LoggerTest", "hello");
    Logger.clear();

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    Logger.info("LoggerTest", "after unsubscribe");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("enforces ring buffer maxEntries", () => {
    Logger.configure({ maxEntries: 2 });

    Logger.info("LoggerTest", "first");
    Logger.info("LoggerTest", "second");
    Logger.info("LoggerTest", "third");

    const entries = Logger.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe("second");
    expect(entries[1].message).toBe("third");
  });

  it("captures stack trace from nested error payload", () => {
    const nestedError = new Error("boom");
    Logger.error("LoggerTest", "failed", { error: nestedError });

    const entries = Logger.getEntries();
    const entry = entries[entries.length - 1];
    expect(entry?.stackTrace).toContain("Error: boom");
  });

  it("exports circular payloads safely and redacts sensitive fields", () => {
    const payload: Record<string, unknown> = {
      token: "secret-token",
      apiKey: "secret-key",
      nested: {
        authorization: "Bearer 123",
      },
    };
    payload.self = payload;

    Logger.info("LoggerTest", "circular", payload);

    const exported = Logger.exportJSON();
    const parsed = JSON.parse(exported) as Array<{ data: Record<string, unknown> }>;
    const data = parsed[0].data;

    expect(data.token).toBe("[REDACTED]");
    expect(data.apiKey).toBe("[REDACTED]");
    expect((data.nested as Record<string, unknown>).authorization).toBe("[REDACTED]");
    expect(data.self).toBe("[Circular]");
  });
});
