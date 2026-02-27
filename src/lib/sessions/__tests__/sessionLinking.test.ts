import { resolveImportSessionId } from "../sessionLinking";

describe("resolveImportSessionId", () => {
  it("returns session id when active session is running", () => {
    expect(resolveImportSessionId({ id: "live-1", status: "running" })).toBe("live-1");
  });

  it("returns session id when active session is paused", () => {
    expect(resolveImportSessionId({ id: "live-2", status: "paused" })).toBe("live-2");
  });

  it("returns undefined when no active session exists", () => {
    expect(resolveImportSessionId(null)).toBeUndefined();
  });
});
