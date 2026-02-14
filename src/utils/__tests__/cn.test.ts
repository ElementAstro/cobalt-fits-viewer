import { cn } from "../cn";

describe("cn", () => {
  it("should concatenate class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should filter out falsy values", () => {
    expect(cn("foo", undefined, "bar", null, false)).toBe("foo bar");
  });

  it("should return empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("should return empty string for all falsy arguments", () => {
    expect(cn(undefined, null, false)).toBe("");
  });

  it("should handle single class name", () => {
    expect(cn("foo")).toBe("foo");
  });
});
