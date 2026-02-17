import { Logger } from "../logger";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("Logger", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    Logger.clear();
    Logger.configure({
      maxEntries: 2000,
      minLevel: "debug",
      consoleOutput: false,
      persistEnabled: true,
      persistKey: "logger-test",
      persistDebounceMs: 0,
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

  it("isolates listener errors while continuing notifications", () => {
    const broken = jest.fn(() => {
      throw new Error("listener failed");
    });
    const healthy = jest.fn();
    Logger.subscribe(broken);
    Logger.subscribe(healthy);

    Logger.info("LoggerTest", "hello");
    expect(broken).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
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

  it("redacts sensitive auth-like string values even when key is non-sensitive", () => {
    Logger.info("LoggerTest", "sensitive values", {
      payload: "Bearer test-token-123",
      another: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.a.b",
    });
    const parsed = JSON.parse(Logger.exportJSON()) as Array<{ data: Record<string, unknown> }>;
    const data = parsed[0].data;
    expect(data.payload).toBe("[REDACTED]");
    expect(data.another).toBe("[REDACTED]");
  });

  it("hydrates persisted entries and respects ring buffer limit", async () => {
    const key = "logger-hydrate-test";
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: "1",
            timestamp: 1,
            level: "info",
            tag: "Persist",
            message: "first",
          },
          {
            id: "2",
            timestamp: 2,
            level: "warn",
            tag: "Persist",
            message: "second",
          },
          {
            id: "3",
            timestamp: 3,
            level: "error",
            tag: "Persist",
            message: "third",
          },
        ],
      }),
    );

    Logger.clear();
    Logger.configure({
      maxEntries: 2,
      minLevel: "debug",
      consoleOutput: false,
      persistEnabled: true,
      persistKey: key,
      persistDebounceMs: 0,
    });
    await Logger.hydrate();

    const restored = Logger.getEntries();
    expect(restored).toHaveLength(2);
    expect(restored[0].message).toBe("second");
    expect(restored[1].message).toBe("third");
  });
});
